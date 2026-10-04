import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// 用法：QA_ROUND=round-2 node scripts/runtime-performance.mjs
// 先另行执行构建并启动生产预览；本脚本不会启动服务器或修改应用状态以外的文件。
const base = process.env.QA_URL ?? 'http://127.0.0.1:4173/outsider-01/';
const round = process.env.QA_ROUND ?? 'runtime';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('QA_ROUND 只能含字母、数字、点、连字符和下划线。');
const out = resolve(`artifacts/quality/${round}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.QA_HEADED !== '1' });
const result = {
  round, base, capturedAt: new Date().toISOString(), browser: browser.version(),
  method: {
    browser: '本机安装的桌面 Chrome；手机配置只是视口/触摸/DPR 模拟，不是实体手机、移动 GPU 或移动网络性能。',
    renderFps: 'canvas 的 data-render-count 增量 ÷ performance.now 实际经过时长；每次完整舞台绘制记一次，多视图不重复计帧。',
    movingFps: '使用每次完整舞台绘制后同步记录的计数、CPU 提交完成时刻和明确动作推进区段号。只累计同一推进区段内相邻实绘记录的计数差/时长差；跨驻留的边界不计，区段内真实长帧全部保留。不使用先行更新的时间线输入判断实绘帧。',
    raf: 'requestAnimationFrame 间隔分布单独报告，只反映页面回调调度，不能冒充真实绘制帧率。',
    duration: '每种模式至少 6 秒；运动观察区间不足累计 3 秒则继续，最多 12 秒。仍不足时标记样本无效。',
    limits: '统计的是 renderer 完成舞台绘制调用，不是 GPU 呈现确认。每个运动区段第一帧只有基准、没有帧间隔；跨状态而无法精确分类的绘制单列，不补帧。单次本机运行受调度、刷新率、温度和其它进程影响，不是跨设备保证。总体 FPS 含有意驻留，不能仅凭它判定掉帧。',
    fonts: 'Resource Timing 提供响应体/解码大小，Chrome DevTools Protocol 的 loadingFinished 提供含协议开销的实际传输量；缓存命中可能为 0。',
  },
  configurations: [], errors: [],
};

async function settleCanvas(page, selector) {
  await page.locator(selector).waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForFunction(sel => Number(document.querySelector(sel)?.dataset.renderCount ?? 0) > 0, selector, { timeout: 20000 });
  await page.waitForTimeout(500);
}

async function scrollToCanvas(page, selector) {
  await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    window.scrollTo({ top: rect.top + scrollY - 84, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
}

async function measure(page, selector, mode) {
  return page.evaluate(async ({ selector, mode }) => {
    const canvas = document.querySelector(selector);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`未找到实际画布：${selector}`);
    if (canvas.dataset.renderSegment === undefined) throw new Error('构建缺少同帧绘制诊断字段，请重新构建后测量，不能沿用旧版时间线估计。');
    const read = now => ({
      ms: now, count: Number(canvas.dataset.renderCount ?? 0),
      time: Number(canvas.dataset.renderModelTime), renderTime: Number(canvas.dataset.renderTime),
      advancing: canvas.dataset.renderAdvancing === 'true', segment: Number(canvas.dataset.renderSegment),
      tier: canvas.dataset.quality ?? 'unknown',
    });
    const samples = [read(performance.now())];
    const rafIntervals = [];
    const renderIntervals = [];
    const movingRenderIntervals = [];
    let movingMs = 0, movingRenders = 0, mergedRenderObservations = 0;
    let boundaryRenders = 0, stationaryRenders = 0;
    let previousDraw = samples[0];
    await new Promise(resolve => {
      const next = now => {
        const current = read(now);
        const previous = samples.at(-1);
        const interval = current.ms - previous.ms;
        const increment = current.count - previous.count;
        if (samples.length > 1) rafIntervals.push(interval);
        if (increment > 1) mergedRenderObservations += 1;
        if (increment > 0) {
          const drawInterval = current.renderTime - previousDraw.renderTime;
          const drawIncrement = current.count - previousDraw.count;
          renderIntervals.push(drawInterval);
          if (current.advancing && previousDraw.advancing && current.segment === previousDraw.segment) {
            // 只用同一明确推进区段的实绘时间；不按间隔长短删帧。
            movingMs += drawInterval;
            movingRenders += drawIncrement;
            movingRenderIntervals.push(drawInterval);
          } else if (!current.advancing && !previousDraw.advancing && current.segment === previousDraw.segment) {
            stationaryRenders += drawIncrement;
          } else {
            boundaryRenders += drawIncrement;
          }
          previousDraw = current;
        }
        samples.push(current);
        const elapsed = now - samples[0].ms;
        if ((elapsed >= 6000 && movingMs >= 3000) || elapsed >= 12000) resolve();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
    const start = samples[0], end = samples.at(-1);
    const quantile = (sorted, p) => {
      if (!sorted.length) return null;
      const index = (sorted.length - 1) * p, low = Math.floor(index), high = Math.ceil(index);
      return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
    };
    const distribution = values => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        samples: values.length, minimumMs: sorted[0] ?? null, medianMs: quantile(sorted, .5),
        p95Ms: quantile(sorted, .95), p99Ms: quantile(sorted, .99), maximumMs: sorted.at(-1) ?? null,
        over33ms: values.filter(value => value > 33.34).length,
        over50ms: values.filter(value => value > 50).length,
      };
    };
    return {
      mode, elapsedMs: end.ms - start.ms, renderedFrames: end.count - start.count,
      renderFps: (end.count - start.count) * 1000 / (end.ms - start.ms),
      moving: { elapsedMs: movingMs, renderedFrames: movingRenders, renderFps: movingMs ? movingRenders * 1000 / movingMs : null, valid: movingMs >= 3000, observedRenderIntervals: distribution(movingRenderIntervals) },
      rafIntervals: distribution(rafIntervals), observedRenderIntervals: distribution(renderIntervals),
      boundaryRenders, stationaryRenders, mergedRenderObservations,
      intervalDistributionNote: '若 mergedRenderObservations 非零，观察间隔可能含多个实际绘制；计数差仍保留，间隔分布不代表逐帧分布。边界计数不补到运动帧中。',
      tierAtStart: start.tier, tierAtEnd: end.tier,
      miniViews: mode === 'cover' ? 0 : document.querySelectorAll('.lab__minis .mini').length,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      canvas: { width: canvas.width, height: canvas.height },
      rawSamples: samples.map(sample => ({
        ms: Number((sample.ms - start.ms).toFixed(3)), count: sample.count - start.count, time: sample.time,
        renderMs: Number((sample.renderTime - start.renderTime).toFixed(3)), advancing: sample.advancing, segment: sample.segment,
      })),
    };
  }, { selector, mode });
}

async function offscreenCheck(page, canvasSelector, label) {
  const handle = await page.locator(canvasSelector).elementHandle();
  await page.locator('#notes').evaluate(element => {
    window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 84, behavior: 'instant' });
  });
  await page.waitForTimeout(600); // 排除离屏前已排队的最后一次绘制。
  const start = await handle.evaluate(canvas => ({ count: Number(canvas.dataset.renderCount ?? 0), time: performance.now(), active: canvas.dataset.active }));
  await page.waitForTimeout(1200);
  const end = await handle.evaluate(canvas => ({ count: Number(canvas.dataset.renderCount ?? 0), time: performance.now(), active: canvas.dataset.active }));
  const paused = label === 'lab' ? await page.locator('.lab__play').getAttribute('aria-pressed') === 'false' : null;
  await handle.dispose();
  return { label, elapsedMs: end.time - start.time, renderedFrames: end.count - start.count, stopped: end.count === start.count, active: end.active ?? null, playbackPaused: paused };
}

async function fontSnapshot(page, networkFonts) {
  const resources = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(new URL(entry.name).pathname))
    .map(entry => ({ url: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, durationMs: entry.duration })));
  return {
    resources, requests: [...networkFonts.values()].map(entry => ({ ...entry })),
    resourceTimingTransferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
    encodedBodyBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    decodedBodyBytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
    actualNetworkTransferBytes: [...networkFonts.values()].reduce((sum, entry) => sum + (entry.actualTransferBytes ?? 0), 0),
  };
}

try {
  for (const mobile of [false, true]) {
    const config = {
      name: mobile ? '手机视口模拟' : '桌面', width: mobile ? 375 : 1440, height: mobile ? 812 : 900,
      deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
    };
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.deviceScaleFactor, isMobile: mobile, hasTouch: mobile,
      colorScheme: 'light', reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const networkFonts = new Map(), externalRequests = [], pageErrors = [];
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await page.addInitScript(() => performance.setResourceTimingBufferSize(2000));
    cdp.on('Network.responseReceived', event => {
      if (event.type === 'Font' || /^(?:font\/|application\/(?:font|x-font))/i.test(event.response.mimeType)) {
        networkFonts.set(event.requestId, { url: event.response.url, status: event.response.status, fromDiskCache: event.response.fromDiskCache ?? false, fromServiceWorker: event.response.fromServiceWorker ?? false });
      }
    });
    cdp.on('Network.loadingFinished', event => {
      const font = networkFonts.get(event.requestId);
      if (font) font.actualTransferBytes = event.encodedDataLength;
    });
    page.on('request', request => {
      if (/^https?:/i.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) externalRequests.push(request.url());
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    const entry = { ...config, measurements: [], offscreen: [], firstScreenFonts: null, allFonts: null, externalRequests, pageErrors };
    result.configurations.push(entry);
    try {
      await page.goto(base + 'report.html', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await scrollToCanvas(page, '#cover [data-story-slot]');
      await settleCanvas(page, '#cover canvas');
      entry.firstScreenFonts = await fontSnapshot(page, networkFonts);
      if (await page.locator('.cover-play').getAttribute('aria-pressed') !== 'true') await page.locator('.cover-play').dispatchEvent('click');
      entry.measurements.push(await measure(page, '#cover canvas', 'cover'));
      entry.offscreen.push(await offscreenCheck(page, '#cover canvas', 'cover'));

      await page.locator('#lab').scrollIntoViewIfNeeded();
      await page.locator('#lab-mount canvas').waitFor({ state: 'attached', timeout: 20000 });
      await scrollToCanvas(page, '.lab__stage');
      await settleCanvas(page, '#lab-mount canvas');
      // 调用现有控件事件，不新增私有测试接口。先设模式，再把画面置于视口，避免点击离屏控件自动滚走。
      await page.locator('[data-speed="real"]').dispatchEvent('click');
      for (const minis of mobile ? [false, true] : [true]) {
        if (mobile) {
          const expanded = await page.locator('.lab__multi-toggle').getAttribute('aria-expanded') === 'true';
          if (expanded !== minis) await page.locator('.lab__multi-toggle').dispatchEvent('click');
        }
        await scrollToCanvas(page, '.lab__stage');
        if (await page.locator('.lab__play').getAttribute('aria-pressed') !== 'true') await page.locator('.lab__play').dispatchEvent('click');
        await page.waitForTimeout(500);
        entry.measurements.push(await measure(page, '#lab-mount canvas', minis ? 'lab-real-three-views' : 'lab-real-main-view'));
      }
      entry.offscreen.push(await offscreenCheck(page, '#lab-mount canvas', 'lab'));
      entry.allFonts = await fontSnapshot(page, networkFonts);
      entry.desktopThreeViewNote = mobile ? null : '桌面产品界面固定展示三视图，没有关闭入口；只测真实可用的三视图开启模式。';
      for (const sample of entry.measurements) {
        console.log(`${config.name} / ${sample.mode}：总体实绘 ${sample.renderFps.toFixed(1)} 帧/秒；运动区间 ${sample.moving.elapsedMs.toFixed(0)} 毫秒，实绘 ${sample.moving.renderFps?.toFixed(1) ?? '无'} 帧/秒；RAF 中位 ${sample.rafIntervals.medianMs?.toFixed(2)} 毫秒。`);
      }
      console.log(`${config.name}：离屏停止 ${entry.offscreen.every(check => check.stopped) ? '通过' : '未通过'}；首屏字体响应体 ${(entry.firstScreenFonts.encodedBodyBytes / 1024).toFixed(1)} KB，总实际字体传输 ${(entry.allFonts.actualNetworkTransferBytes / 1024).toFixed(1)} KB；第三方请求 ${externalRequests.length} 个。`);
    } catch (error) {
      entry.error = String(error.stack ?? error);
      result.errors.push({ configuration: config.name, message: String(error) });
      console.error(`${config.name}测量失败：${error.message}`);
    } finally {
      await context.close();
      await writeFile(resolve(out, 'runtime-performance.json'), JSON.stringify(result, null, 2));
    }
  }
} finally {
  await browser.close();
  await writeFile(resolve(out, 'runtime-performance.json'), JSON.stringify(result, null, 2));
}
const invalid = result.configurations.some(config => config.error || config.measurements.some(sample => !sample.moving.valid) || config.offscreen.some(check => !check.stopped) || config.externalRequests.length || config.pageErrors.length);
console.log(`报告已写入 ${resolve(out, 'runtime-performance.json')}。手机数据仅代表本机桌面 Chrome 的手机视口模拟。`);
if (invalid) process.exitCode = 1;
