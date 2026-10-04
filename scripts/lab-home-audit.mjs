import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// 运行生产预览后执行；截图检查与 Lighthouse 性能测量应分别运行。
const base = new URL(process.env.QA_URL ?? 'http://127.0.0.1:4173/outsider-01/');
if (!base.pathname.endsWith('/')) throw new Error('QA_URL 应以 / 结尾');
const round = process.env.QA_ROUND ?? 'lab-restore';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('无效的检查目录');
const out = resolve('artifacts/quality', round);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = {
  round, base: base.href, capturedAt: new Date().toISOString(), browser: browser.version(),
  note: '真实桌面 Chrome 截图和交互；手机、平板为视口模拟，未测实体设备帧率。本脚本与 Lighthouse 分开运行。',
  pages: [], extra: [], fatal: [],
};
const homeURL = lang => new URL(lang === 'en' ? 'en/' : './', base).href;
const reportURL = lang => new URL(lang === 'en' ? 'en/report.html' : 'report.html', base).href;
const save = () => writeFile(resolve(out, 'lab-home-audit.json'), JSON.stringify(report, null, 2));
const stageSelector = '#lab-root .lab__stage';

function observe(page) {
  const log = { pageErrors: [], consoleErrors: [], failed: [], httpErrors: [], foreign: [], requests: [], aborted: [] };
  page.on('pageerror', error => log.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') log.consoleErrors.push(message.text()); });
  page.on('request', request => {
    log.requests.push(request.url());
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base.origin) log.foreign.push(request.url());
  });
  page.on('requestfailed', request => {
    const item = { url: request.url(), reason: request.failure()?.errorText ?? '未知原因' };
    (item.reason.includes('ABORTED') ? log.aborted : log.failed).push(item);
  });
  page.on('response', response => {
    if (response.status() >= 400) log.httpErrors.push({ url: response.url(), status: response.status() });
  });
  return log;
}

async function check(entry, name, fn) {
  try {
    const detail = await fn();
    entry.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    entry.checks.push({ name, passed: false, error: String(error) });
    console.log(`失败：${entry.key} · ${name}：${String(error)}`);
  }
}

async function shot(page, entry, suffix, selector) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
  else await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  // 等待预设相机过渡完成，再把画面作为该视角的截图证据。
  await page.waitForTimeout(650);
  const filename = `${entry.key}-${suffix}.png`;
  await page.screenshot({ path: resolve(out, filename) });
  entry.shots.push(filename);
}

async function ready(page) {
  await page.locator('#lab-root .lab__play').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#lab-root canvas')?.dataset.ready === 'true', undefined, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

async function layout(page) {
  return page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      stage: rect('#lab-root .lab__stage'), panel: rect('#lab-root .lab__panel'), body: rect('#lab-root .lab__body'),
    };
  });
}

async function assertLayout(page) {
  const geometry = await layout(page);
  assert.equal(geometry.overflow, false, '页面出现横向溢出');
  assert.ok(geometry.stage && geometry.panel && geometry.body, '舞台和控制面板完整存在');
  assert.ok(geometry.stage.right <= geometry.body.right + 1, '舞台超出容器');
  const beside = geometry.panel.left >= geometry.stage.left + geometry.stage.width * .5;
  if (beside) assert.ok(geometry.stage.right <= geometry.panel.left + 1, '舞台覆盖右侧控制区');
  else assert.ok(geometry.stage.bottom <= geometry.panel.top + 1, '舞台覆盖下方控制区');
  return geometry;
}

async function dragTimeline(page, fraction) {
  const slider = page.locator('#lab-root .timeline__input');
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  assert.ok(box && box.width > 30, '时间轴具有可拖动尺寸');
  const current = await slider.evaluate(element => Number(element.value) / Number(element.max));
  // 原生 range 两端保留半个滑块宽度，目标值只断言范围，不伪装成精确毫秒输入。
  const x = amount => box.x + 8 + (box.width - 16) * amount;
  const y = box.y + box.height / 2;
  await page.mouse.move(x(current), y);
  await page.mouse.down();
  await page.mouse.move(x(fraction), y, { steps: 10 });
  await page.mouse.up();
  return {
    time: Number(await slider.inputValue()),
    phase: (await page.locator('#lab-root .lab__phase-name').textContent())?.trim(),
    separation: (await page.locator('#lab-root [data-ro="sep"]').textContent())?.trim(),
    valueText: await slider.getAttribute('aria-valuetext'),
  };
}

async function clickPath(page, target) {
  const expected = new URL(target);
  const links = page.locator('a[href]');
  for (const link of await links.all()) {
    const href = await link.getAttribute('href');
    const url = new URL(href, page.url());
    if (url.origin === expected.origin && url.pathname === expected.pathname && await link.isVisible()) {
      await link.click();
      await page.waitForURL(url => url.origin === expected.origin && url.pathname === expected.pathname);
      return;
    }
  }
  assert.fail(`页面缺少可点击导航：${expected.pathname}`);
}

async function networkChecks(entry, { expectedWebglError = false } = {}) {
  await check(entry, '页面错误与请求记录', () => {
    assert.deepEqual(entry.network.pageErrors, []);
    // 模拟 WebGL 失效会让 Three.js 输出预期错误；其他错误仍计为失败。
    const unexpected = expectedWebglError
      ? entry.network.consoleErrors.filter(text => !/Error creating WebGL context|WebGL.*(unavailable|not supported)/i.test(text))
      : entry.network.consoleErrors;
    assert.deepEqual(unexpected, []);
    assert.deepEqual(entry.network.failed, []);
    assert.deepEqual(entry.network.httpErrors, []);
    assert.deepEqual(entry.network.foreign, []);
  });
}

try {
  for (const device of ['desktop', 'mobile']) for (const theme of ['light', 'dark']) for (const lang of ['zh', 'en']) {
    const entry = { key: `${device}-${theme}-${lang}`, device, theme, lang, checks: [], shots: [] };
    report.pages.push(entry);
    const context = await browser.newContext({
      viewport: device === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 },
      colorScheme: theme, deviceScaleFactor: 1,
    });
    await context.addInitScript(choice => {
      if (localStorage.getItem('outsider01-theme') === null) localStorage.setItem('outsider01-theme', choice);
    }, theme);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    entry.network = observe(page);
    try {
      await page.goto(homeURL(lang), { waitUntil: 'networkidle' });
      await check(entry, '首页挂载三维实验室', async () => {
        await ready(page);
        assert.equal(await page.locator('html').getAttribute('lang'), lang === 'zh' ? 'zh-CN' : 'en');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('#lab-root canvas').count(), 1);
        return assertLayout(page);
      });
      await shot(page, entry, 'home');
      await check(entry, '俯视与轴测实际切换', async () => {
        await page.locator('#lab-root [data-view="top"]').click();
        assert.equal(await page.locator('#lab-root [data-view="top"]').getAttribute('aria-pressed'), 'true');
        await shot(page, entry, 'top', stageSelector);
        await page.locator('#lab-root [data-view="axo"]').click();
        assert.equal(await page.locator('#lab-root [data-view="axo"]').getAttribute('aria-pressed'), 'true');
        await shot(page, entry, 'axo', stageSelector);
      });
      await check(entry, '肩轴与髋轴等五项图例可见', async () => {
        const legend = page.locator('#lab-root .lab__diagram-key');
        assert.equal(await legend.isVisible(), true);
        const text = (await legend.textContent()) ?? '';
        assert.match(text, lang === 'zh' ? /肩轴/ : /shoulder/i);
        assert.match(text, lang === 'zh' ? /髋轴/ : /hip/i);
        await shot(page, entry, 'diagram-key', '#lab-root .lab__diagram-key');
        return { text: text.trim() };
      });
      await check(entry, '正反手与三种站位可点击', async () => {
        for (const stroke of ['backhand', 'forehand']) {
          await page.locator(`#lab-root [data-stroke="${stroke}"]`).click();
          assert.equal(await page.locator(`#lab-root [data-stroke="${stroke}"]`).getAttribute('aria-pressed'), 'true');
          for (const stance of ['neutral', 'open', 'semi']) {
            await page.locator(`#lab-root [data-stance="${stance}"]`).click();
            assert.equal(await page.locator(`#lab-root [data-stance="${stance}"]`).getAttribute('aria-pressed'), 'true');
          }
        }
      });
      await check(entry, '拖动时间轴更新阶段和肩髋分离角', async () => {
        const before = await dragTimeline(page, .45);
        const after = await dragTimeline(page, .76);
        assert.ok(after.time > before.time + 200, '实际时间随鼠标拖动前进');
        assert.notEqual(after.phase, before.phase, '阶段名称随时间变化');
        assert.notEqual(after.separation, before.separation, '肩髋分离角随时间变化');
        assert.ok(before.valueText && after.valueText, '时间轴提供可读时间和阶段');
        assert.equal(await page.locator('#lab-root .lab__play').getAttribute('aria-pressed'), 'false');
        return { before, after };
      });
      await check(entry, '按钮和滑块保留原生键盘语义', async () => {
        await page.locator('#lab-root [data-stance="neutral"]').focus();
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#lab-root [data-stance="neutral"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#lab-root .lab__play').getAttribute('aria-pressed'), 'false');
        const slider = page.locator('#lab-root .timeline__input');
        await slider.focus();
        const before = Number(await slider.inputValue());
        await page.keyboard.press('ArrowRight');
        assert.equal(Number(await slider.inputValue()), before + 1);
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#lab-root .lab__play').getAttribute('aria-pressed'), 'false');
      });
      if (device === 'mobile') await check(entry, '手机展开三视图', async () => {
        const toggle = page.locator('#lab-root .lab__multi-toggle');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        await page.waitForFunction(() => document.querySelectorAll('#lab-root .mini').length === 3);
        const labels = (await page.locator('#lab-root .mini__label').allTextContents()).map(text => text.trim());
        assert.equal(labels.length, 3);
        assert.ok(labels.every(Boolean));
        await shot(page, entry, 'three-views', stageSelector);
        return { labels, geometry: await assertLayout(page) };
      });
      await check(entry, '整页 WCAG 扫描', async () => {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        entry.violations = result.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
        assert.deepEqual(entry.violations, []);
      });
      await check(entry, '主题切换后刷新持久保存', async () => {
        const toggle = page.locator('[data-theme-toggle]').first();
        const original = await toggle.getAttribute('data-choice');
        await toggle.click();
        const choice = await toggle.getAttribute('data-choice');
        assert.ok(choice && choice !== original);
        assert.equal(await page.evaluate(() => localStorage.getItem('outsider01-theme')), choice);
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.locator('[data-theme-toggle]').first().getAttribute('data-choice'), choice);
      });
      await check(entry, '首页、报告与双语导航连通', async () => {
        await clickPath(page, reportURL(lang));
        assert.equal(await page.locator('#cover').count(), 1, '报告保留原章节内容');
        await clickPath(page, homeURL(lang));
        await ready(page);
        const other = lang === 'zh' ? 'en' : 'zh';
        await page.locator('[data-lang-link]').first().click();
        await page.waitForURL(url => url.pathname === new URL(homeURL(other)).pathname);
        assert.equal(await page.locator('html').getAttribute('lang'), other === 'zh' ? 'zh-CN' : 'en');
        await ready(page);
      });
    } catch (error) {
      entry.checks.push({ name: '该组合执行完成', passed: false, error: String(error) });
    } finally {
      await networkChecks(entry);
      await context.close();
      await save();
      console.log(`${entry.key}：截图 ${entry.shots.length} 张，检查 ${entry.checks.length} 项，失败 ${entry.checks.filter(item => !item.passed).length} 项`);
    }
  }

  for (const lang of ['zh', 'en']) {
    const entry = { key: `no-js-${lang}`, checks: [], shots: [] };
    report.extra.push(entry);
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    entry.network = observe(page);
    try {
      await page.goto(homeURL(lang), { waitUntil: 'networkidle' });
      await check(entry, '无脚本首页保留图示与正文', async () => {
        const detail = await page.evaluate(() => ({
          text: document.querySelector('main')?.innerText.trim().length ?? 0,
          svg: [...document.querySelectorAll('main svg')].filter(element => element.getBoundingClientRect().width > 80 && element.getBoundingClientRect().height > 80).length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        assert.ok(detail.text > 60, '无脚本仍显示有意义的正文');
        assert.ok(detail.svg >= 1, '无脚本显示静态人体示意图');
        assert.equal(await page.locator('.lab-home-static__figure svg').isVisible(), true);
        assert.equal(await page.locator('[data-home-status]').isVisible(), true);
        assert.equal(detail.overflow, false);
        return detail;
      });
      await shot(page, entry, 'home');
    } finally { await networkChecks(entry); await context.close(); await save(); }
  }

  for (const mode of ['force2d', 'reduced-motion', 'webgl-unavailable']) {
    const entry = { key: mode, checks: [], shots: [] };
    report.extra.push(entry);
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
    if (mode === 'webgl-unavailable') await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
      };
    });
    const page = await context.newPage();
    entry.network = observe(page);
    try {
      await page.goto(homeURL('zh') + (mode === 'force2d' ? '?force2d=1' : ''), { waitUntil: 'networkidle' });
      await page.locator('#lab-root .lab__play').waitFor({ state: 'visible' });
      await check(entry, '对应降级条件实际生效', async () => {
        if (mode === 'reduced-motion') {
          await ready(page);
          const before = await page.locator('#lab-root .timeline__input').inputValue();
          await page.waitForTimeout(700);
          assert.equal(await page.locator('#lab-root .lab__play').getAttribute('aria-pressed'), 'false');
          assert.equal(await page.locator('#lab-root .timeline__input').inputValue(), before);
        } else {
          await page.locator('#lab-root .lab__notice').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#lab-root canvas').count(), 0);
          assert.equal(await page.locator('#lab-root .lab__stage > svg').count(), 1);
          assert.equal(await page.locator('#lab-root .lab__diagram-key').isVisible(), false, '三维图例不混入二维降级界面');
          await page.locator('#lab-root [data-stroke="backhand"]').click();
          assert.equal(await page.locator('#lab-root [data-stroke="backhand"]').getAttribute('aria-pressed'), 'true');
          if (mode === 'force2d') {
            const downloaded = entry.network.requests.filter(url => /(?:three|\/render3d\/stage\.(?:ts|js)|\/stage-[\w-]+\.js)/i.test(url));
            assert.deepEqual(downloaded, [], '强制二维模式不下载 Three.js 或舞台模块');
          }
        }
        return assertLayout(page);
      });
      await shot(page, entry, 'home');
    } finally { await networkChecks(entry, { expectedWebglError: mode === 'webgl-unavailable' }); await context.close(); await save(); }
  }

  for (const width of [820, 1024]) {
    const entry = { key: `tablet-${width}`, checks: [], shots: [] };
    report.extra.push(entry);
    const context = await browser.newContext({ viewport: { width, height: 1180 }, colorScheme: width === 820 ? 'light' : 'dark' });
    const page = await context.newPage();
    entry.network = observe(page);
    try {
      await page.goto(homeURL('en'), { waitUntil: 'networkidle' });
      await check(entry, '平板舞台和面板无遮挡且可操作', async () => {
        await ready(page);
        const geometry = await assertLayout(page);
        for (const stroke of ['backhand', 'forehand']) {
          await page.locator(`#lab-root [data-stroke="${stroke}"]`).click({ timeout: 3000 });
          assert.equal(await page.locator(`#lab-root [data-stroke="${stroke}"]`).getAttribute('aria-pressed'), 'true');
        }
        await page.locator('#lab-root [data-view="top"]').click({ timeout: 3000 });
        assert.equal(await page.locator('#lab-root [data-view="top"]').getAttribute('aria-pressed'), 'true');
        return geometry;
      });
      await shot(page, entry, 'home');
      await shot(page, entry, 'controls', '#lab-root .lab__panel');
    } finally { await networkChecks(entry); await context.close(); await save(); }
  }
} catch (error) {
  report.fatal.push(String(error));
  console.error(`验收脚本中断：${String(error)}`);
} finally {
  report.passed = report.fatal.length === 0 && report.pages.length === 8 && report.extra.length === 7
    && [...report.pages, ...report.extra].every(entry => entry.checks.length > 0 && entry.checks.every(item => item.passed));
  await save();
  await browser.close();
}
console.log(`实验室首页验收${report.passed ? '通过' : '有待修复项'}：${resolve(out, 'lab-home-audit.json')}`);
if (!report.passed) process.exitCode = 1;
