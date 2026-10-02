import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5173/';
const round = process.env.QA_ROUND ?? 'round-1';
const out = resolve(`artifacts/quality/${round}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const sections = ['cover', 'abstract', 'fig-01', 'fig-02', 'fig-03', 'fig-04', 'lab', 'conclusion', 'notes'];
const configs = ['desktop', 'mobile'].flatMap(device => ['light', 'dark'].flatMap(theme => ['zh', 'en'].map(lang => ({
  device, theme, lang, width: device === 'desktop' ? 1440 : 375, height: device === 'desktop' ? 900 : 812,
}))));
const result = { round, base, capturedAt: new Date().toISOString(), browser: browser.version(), note: '真实桌面 Chrome 的两种视口；手机为视口模拟，不是实体手机性能。', pages: [], extra: [] };

try {
  for (const config of configs) {
    const key = `${config.device}-${config.theme}-${config.lang}`;
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, colorScheme: config.theme, deviceScaleFactor: 1 });
    await context.addInitScript(theme => localStorage.setItem('outsider01-theme', theme), config.theme);
    const page = await context.newPage();
    const errors = [], foreign = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) foreign.push(request.url()); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ABORTED')) failed.push({ url: request.url(), reason: request.failure()?.errorText }); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    await page.goto(base + (config.lang === 'en' ? 'en/' : ''), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const shots = [];
    for (const id of sections) {
      await page.evaluate(id => {
        const element = document.getElementById(id);
        window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 84, behavior: 'instant' });
      }, id);
      await page.waitForTimeout(id === 'lab' ? 900 : 450);
      // 验证布局增强已稳定，不能用拍到前一节的图片冒充当前节验收。
      await page.evaluate(id => {
        const element = document.getElementById(id);
        window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 84, behavior: 'instant' });
      }, id);
      await page.waitForTimeout(220);
      const file = `${key}-${id}.png`;
      await page.screenshot({ path: resolve(out, file) });
      shots.push(file);
    }
    for (const id of ['fig-01', 'fig-03', 'fig-04']) {
      await page.evaluate(id => {
        const step = document.querySelector(`#${id} .story-step:nth-child(4)`);
        window.scrollTo({ top: step.getBoundingClientRect().top + scrollY - innerHeight * .57, behavior: 'instant' });
      }, id);
      await page.waitForTimeout(850);
      const file = `${key}-${id}-contact.png`;
      await page.screenshot({ path: resolve(out, file) });
      shots.push(file);
    }
    const semantics = await page.evaluate(() => ({
      lang: document.documentElement.lang, title: document.title,
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      overflowElements: [...document.querySelectorAll('body *')].filter(e => {
        const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(e).position !== 'fixed' && !e.closest('.sr-only, .table-scroll');
      }).slice(0, 12).map(e => ({ tag: e.tagName, class: e.getAttribute('class') })),
      storyCanvases: document.querySelectorAll('.stage-slot canvas').length,
      labCanvases: document.querySelectorAll('#lab-mount canvas').length,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    }));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(350);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const violations = axe.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
    result.pages.push({ ...config, errors: [...new Set(errors)], foreign: [...new Set(foreign)], failed, semantics, violations, shots });
    await writeFile(resolve(out, 'browser-audit.json'), JSON.stringify(result, null, 2));
    console.log(`${key}：${shots.length} 张截图，错误 ${errors.length}，无障碍 ${violations.length}，横向溢出 ${semantics.overflow}`);
    await context.close();
  }
  // 降级不是“截图看起来像”：检查无脚本文字，强制2D网络，以及减少动效的状态。
  for (const lang of ['zh', 'en']) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(base + (lang === 'en' ? 'en/' : ''), { waitUntil: 'networkidle' });
    const check = await page.evaluate(() => ({ sections: document.querySelectorAll('main > section').length, svg: document.querySelectorAll('.phase-static svg').length, text: document.body.innerText.length, overflow: document.documentElement.scrollWidth > innerWidth }));
    await page.screenshot({ path: resolve(out, `no-js-${lang}.png`) });
    result.extra.push({ type: 'no-js', lang, ...check });
    await context.close();
  }
  for (const mode of ['force2d', 'reduced-motion']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(`${base}${mode === 'force2d' ? '?force2d=1' : ''}`, { waitUntil: 'networkidle' });
    await page.locator('#lab').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const check = await page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, play: document.querySelector('.lab__play')?.getAttribute('aria-pressed'), overflow: document.documentElement.scrollWidth > innerWidth }));
    await page.screenshot({ path: resolve(out, `${mode}-lab.png`) });
    result.extra.push({ type: mode, ...check, threeRequests: requests.filter(url => /(?:three|\/render3d\/stage\.ts|\/stage-[\w-]+\.js)/.test(url)) });
    await context.close();
  }
  for (const width of [820, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 1180 }, colorScheme: width === 820 ? 'light' : 'dark' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + 'en/', { waitUntil: 'networkidle' });
    for (const id of ['cover', 'fig-03', 'lab']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(out, `tablet-${width}-${id}.png`) });
    }
    result.extra.push({ type: 'tablet', width, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /webgl/.test(kind) ? null : getContext.call(this, kind, ...args);
      };
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#lab').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const fallback = await page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, svg: document.querySelectorAll('.lab__stage > svg').length, notice: document.querySelector('.lab__notice')?.textContent }));
    await page.screenshot({ path: resolve(out, 'webgl-unavailable.png') });
    result.extra.push({ type: 'webgl-unavailable', ...fallback, passed: fallback.canvas === 0 && fallback.svg === 1 && Boolean(fallback.notice) });
    await context.close();
  }
} finally {
  await writeFile(resolve(out, 'browser-audit.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
if (result.pages.some(page => page.errors.length || page.foreign.length || page.failed.length || page.violations.length || page.semantics.overflow)) process.exitCode = 1;
if (result.extra.some(check => check.overflow || check.errors?.length || check.passed === false)) process.exitCode = 1;
