import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// QA_URL 可指向本机或上线地址；QA_PROXY 可设为 socks5://127.0.0.1:端口。
// 保留浏览器默认 TLS 校验，连接或证书错误将直接使验收失败。
const base = new URL(process.env.QA_URL ?? 'http://127.0.0.1:4176/');
const round = process.env.QA_ROUND ?? 'prototype-release-local';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('无效的检查目录');
const out = resolve('artifacts/quality', round);
const proxy = process.env.QA_PROXY;
if (proxy && !/^(socks5|https?):\/\//.test(proxy)) throw new Error('QA_PROXY 请使用 socks5://、http:// 或 https:// 地址');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) });
const result = {
  base: base.href, proxyEnabled: Boolean(proxy), browser: browser.version(), capturedAt: new Date().toISOString(),
  note: '实际 Chrome 页面和截图；手机为 375×812 视口模拟。保留默认 TLS 校验，不使用模拟响应。',
  pages: [], fatal: [],
};
const save = () => writeFile(resolve(out, 'prototype-release-audit.json'), JSON.stringify(result, null, 2));
const expected = {
  semi: { name: '半开放式', angles: [0, 44, 40, 2, 40], weight: [34, 17, 31, 41, 51] },
  neutral: { name: '中性站位', angles: [0, 25, 30, 5, 40], weight: [34, 17, 37, 54, 61] },
  open: { name: '开放式', angles: [0, 52, 45, 2, 37], weight: [34, 17, 24, 34, 44] },
};

async function check(entry, name, work) {
  try {
    const detail = await work();
    entry.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    entry.checks.push({ name, passed: false, error: String(error) });
    console.log(`失败：${entry.key} · ${name} · ${String(error)}`);
  }
}

async function shot(page, entry, suffix, { selector, fullPage = false } = {}) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
  else await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const filename = `${entry.key}-${suffix}.png`;
  await page.screenshot({ path: resolve(out, filename), fullPage });
  entry.shots.push(filename);
}

async function readState(page) {
  return page.evaluate(() => ({
    title: document.querySelector('#fh-title').textContent,
    progress: Number(document.querySelector('#fh-t').value),
    angle: [...document.querySelectorAll('#fh-stage [data-diagram="shoulder-hip"] text')].map(node => node.textContent).find(text => text.includes('肩髋差')),
    inset: document.querySelector('#fh-stage [data-diagram="shoulder-hip"]').innerHTML,
    weight: parseInt(document.querySelector('#fh-w').style.left, 10),
    play: document.querySelector('#fh-play').textContent,
  }));
}

async function drag(page, fraction) {
  const slider = page.locator('#fh-t');
  await slider.scrollIntoViewIfNeeded();
  const rect = await slider.boundingBox();
  assert.ok(rect && rect.width > 30, '进度滑块可见并具有可拖动宽度');
  const start = Number(await slider.inputValue()) / 400;
  const x = value => rect.x + 8 + (rect.width - 16) * value;
  await page.mouse.move(x(start), rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(x(fraction), rect.y + rect.height / 2, { steps: 12 });
  await page.mouse.up();
  return readState(page);
}

try {
  for (const device of ['desktop', 'mobile']) for (const theme of ['light', 'dark']) {
    const viewport = device === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
    const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: device === 'mobile', hasTouch: device === 'mobile' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const entry = { key: `${device}-${theme}`, viewport, theme, checks: [], shots: [], pageErrors: [], consoleErrors: [], httpErrors: [], failed: [], external: [], requests: [] };
    result.pages.push(entry);
    page.on('pageerror', error => entry.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
    page.on('request', request => {
      entry.requests.push(request.url());
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base.origin) entry.external.push(request.url());
    });
    page.on('requestfailed', request => entry.failed.push({ url: request.url(), reason: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) entry.httpErrors.push({ url: response.url(), status: response.status() }); });
    try {
      await page.goto(base.href, { waitUntil: 'networkidle' });
      await page.locator('#fh-grid .fh-card').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await check(entry, '文档、移动视口和原型布局', async () => {
        const documentState = await page.evaluate(() => {
          const stage = document.querySelector('.playback .stage');
          const legend = document.querySelector('#fh-legend');
          const grid = document.querySelector('#fh-grid');
          const before = (first, second) => Boolean(first && second && (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING));
          return {
            doctype: document.doctype?.name,
            lang: document.documentElement.lang,
            viewport: document.querySelector('meta[name="viewport"]')?.content,
            h1: document.querySelector('h1')?.textContent,
            width: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            cards: document.querySelectorAll('#fh-grid .fh-card').length,
            cardOrder: [...document.querySelectorAll('#fh-grid .fh-card')].map(card => card.dataset.i),
            background: getComputedStyle(document.body).backgroundColor,
            hasGoogleFonts: [...document.querySelectorAll('link[href]')].some(link => /fonts\.(googleapis|gstatic)\.com/.test(link.href)),
            layout: {
              stage: stage?.getBoundingClientRect().toJSON(),
              legend: legend?.getBoundingClientRect().toJSON(),
              grid: grid?.getBoundingClientRect().toJSON(),
              stageBeforeGrid: before(stage, grid),
              stageBeforeLegend: before(stage, legend),
              legendBeforeGrid: before(legend, grid),
            },
          };
        });
        assert.equal(documentState.doctype, 'html');
        assert.match(documentState.lang, /^zh/i);
        assert.match(documentState.viewport, /width=device-width/);
        assert.equal(documentState.h1, '网球正手三种站位');
        assert.equal(documentState.width, viewport.width);
        assert.equal(documentState.overflow, false);
        assert.equal(documentState.cards, 5);
        assert.deepEqual(documentState.cardOrder, ['0', '1', '2', '3', '4']);
        assert.equal(documentState.hasGoogleFonts, false);
        assert.equal(documentState.background, theme === 'light' ? 'rgb(243, 245, 241)' : 'rgb(17, 21, 19)');
        const geometry = documentState.layout;
        assert.ok(geometry.stage && geometry.legend && geometry.grid, '动画、独立图例和五阶段卡片完整存在');
        assert.equal(geometry.stageBeforeGrid, true, '文档顺序为动画在卡片之前');
        assert.equal(geometry.stageBeforeLegend, true, '文档顺序为动画在图例之前');
        assert.equal(geometry.legendBeforeGrid, true, '文档顺序为图例在卡片之前');
        assert.ok(geometry.stage.width > 0 && geometry.stage.height > 0 && geometry.legend.width > 0 && geometry.legend.height > 0);
        assert.ok(geometry.stage.bottom <= geometry.grid.top + 1, '动画实际位于五张卡片上方');
        assert.ok(geometry.legend.bottom <= geometry.grid.top + 1, '图例完整位于五张卡片上方');
        if (device === 'desktop') {
          assert.ok(geometry.stage.right <= geometry.legend.left + 1, '桌面图例位于动画右侧且互不遮挡');
          assert.ok(Math.abs(geometry.stage.top - geometry.legend.top) <= 1, '桌面动画与图例顶部对齐');
        } else {
          assert.ok(geometry.stage.bottom <= geometry.legend.top + 1, '手机图例位于动画之后且互不遮挡');
          assert.ok(geometry.legend.left >= 0 && geometry.legend.right <= viewport.width + 1, '手机图例完整位于视口内');
        }
        return documentState;
      });
      await shot(page, entry, 'home');
      await shot(page, entry, 'full', { fullPage: true });
      await shot(page, entry, 'cards', { selector: '#fh-grid' });
      await check(entry, '三站位的五阶段与肩髋小图、承重条同步', async () => {
        const observations = [];
        for (const [stance, values] of Object.entries(expected)) {
          await page.locator(`#fh-st [data-s="${stance}"]`).click();
          assert.equal(await page.locator(`#fh-st [data-s="${stance}"]`).getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('#fh-phase-h').textContent(), `${values.name}的 5 个阶段`);
          assert.equal(await page.locator('#fh-phase tr').count(), 5);
          for (let phase = 0; phase < 5; phase += 1) {
            await page.locator(`#fh-grid .fh-card[data-i="${phase}"]`).click();
            const state = await readState(page);
            assert.ok(state.title.startsWith(`${values.name} · ${phase + 1} `));
            assert.equal(state.angle, `肩髋差 ${values.angles[phase]}°`);
            assert.equal(state.weight, values.weight[phase]);
            assert.equal(state.play, '播放');
            observations.push({ stance, phase: phase + 1, title: state.title, angle: state.angle, weight: state.weight, progress: state.progress });
          }
        }
        return observations;
      });
      await check(entry, '真实拖动时间轴同步更新人体、肩髋和承重', async () => {
        await page.locator('#fh-st [data-s="semi"]').click();
        const before = await drag(page, .22);
        const after = await drag(page, .82);
        assert.ok(after.progress > before.progress + 150);
        assert.notEqual(after.title, before.title);
        assert.notEqual(after.angle, before.angle);
        assert.notEqual(after.inset, before.inset);
        assert.notEqual(after.weight, before.weight);
        assert.equal(after.play, '播放');
        return { before, after };
      });
      await check(entry, '播放推进、暂停保持、速度按钮切换', async () => {
        await page.locator('#fh-grid .fh-card[data-i="0"]').click();
        await page.locator('#fh-play').click();
        assert.equal(await page.locator('#fh-play').textContent(), '暂停');
        const before = await readState(page);
        await page.waitForTimeout(700);
        const moving = await readState(page);
        assert.ok(moving.progress > before.progress);
        assert.notEqual(moving.inset, before.inset);
        await page.locator('#fh-play').click();
        const stopped = await readState(page);
        await page.waitForTimeout(350);
        assert.equal((await readState(page)).progress, stopped.progress);
        assert.equal(await page.locator('#fh-play').textContent(), '播放');
        await page.locator('#fh-speed').click();
        assert.equal(await page.locator('#fh-speed').textContent(), '真实速度');
        await page.locator('#fh-speed').click();
        assert.equal(await page.locator('#fh-speed').textContent(), '慢动作');
        return { before: before.progress, moving: moving.progress, stopped: stopped.progress };
      });
      await check(entry, '承重点说明修正保留，肩髋图例可见', async () => {
        const legend = page.locator('#fh-legend .legend');
        const text = await legend.textContent();
        assert.match(text, /脚下圆环中的实心点：承重位置（模型示意）/);
        assert.match(text, /肩线（末端圆点标记右肩）/);
        assert.match(text, /髋线/);
        assert.match(text, /空心脚印是左脚、实心是右脚/);
        await shot(page, entry, 'legend', { selector: '#fh-legend .legend' });
        return { text };
      });
      await page.locator('#fh-grid .fh-card[data-i="1"]').click();
      await shot(page, entry, 'backswing', { selector: '.stage' });
      await check(entry, '同源资源完整加载且页面运行无错误', async () => {
        assert.deepEqual(entry.pageErrors, []);
        assert.deepEqual(entry.consoleErrors, []);
        assert.deepEqual(entry.httpErrors, []);
        assert.deepEqual(entry.failed, []);
        assert.deepEqual(entry.external, []);
        assert.ok(entry.requests.some(url => /\/assets\/[^/]+\.css(?:\?|$)/.test(url)), '实际加载提取后的样式');
        assert.ok(entry.requests.some(url => /\/assets\/[^/]+\.js(?:\?|$)/.test(url)), '实际加载提取后的脚本');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      });
    } catch (error) {
      entry.checks.push({ name: '页面验收完整执行', passed: false, error: String(error) });
    } finally {
      await context.close();
      await save();
      console.log(`${entry.key}：${entry.shots.length} 张截图，${entry.checks.length} 项检查，${entry.checks.filter(item => !item.passed).length} 项待修复`);
    }
  }
} catch (error) {
  result.fatal.push(String(error));
} finally {
  result.passed = result.fatal.length === 0 && result.pages.length === 4 && result.pages.every(page => page.checks.length === 6 && page.checks.every(check => check.passed));
  await save();
  await browser.close();
}
console.log(`二维原型发布验收${result.passed ? '通过' : '有待修复项'}：${resolve(out, 'prototype-release-audit.json')}`);
if (!result.passed) process.exitCode = 1;
