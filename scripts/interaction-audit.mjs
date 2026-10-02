import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.QA_URL ?? 'http://127.0.0.1:4173/outsider-01/';
const out = resolve(`artifacts/quality/${process.env.QA_ROUND ?? 'round-1-fixed'}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
async function check(name, fn) {
  try { await fn(); checks.push({ name, passed: true }); console.log(`通过：${name}`); }
  catch (error) { checks.push({ name, passed: false, error: String(error) }); console.log(`失败：${name}：${String(error)}`); }
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await check('单画布迁移且章节高度稳定', async () => {
    await page.waitForSelector('.stage-slot canvas');
    const before = await page.locator('#fig-03').evaluate(e => e.offsetHeight);
    for (const id of ['fig-01', 'fig-03', 'fig-04', 'cover']) {
      await page.locator(`#${id} .stage-slot`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.stage-slot canvas').count(), 1);
    }
    assert.ok(Math.abs(before - await page.locator('#fig-03').evaluate(e => e.offsetHeight)) < 2);
  });
  await check('滚动阅读后语言切换保留章节', async () => {
    await page.locator('#fig-02').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 150));
    await page.waitForTimeout(200);
    const link = page.locator('.site-header [data-lang-link]');
    assert.match(await link.getAttribute('href'), /en\/#fig-02/);
    await link.click();
    await page.waitForURL('**/en/#fig-02');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.waitForTimeout(600);
  });
  await check('站位滑块与正反手切换读数同步', async () => {
    await page.locator('#fig-02').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const read = () => page.locator('[data-stance-readout="sep"]').textContent();
    const initial = await read();
    await page.locator('[data-stance-slider]').fill('1');
    await page.locator('[data-stance-slider]').dispatchEvent('input');
    assert.notEqual(await read(), initial);
    await page.locator('[data-stance-stroke="backhand"]').click();
    assert.equal(await page.locator('[data-stance-stroke="backhand"]').getAttribute('aria-pressed'), 'true');
    assert.equal(Number(await read()), 62);
  });
  await check('减少动态效果：不自动播放，五阶段按钮可操作', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#fig-03 .stage-slot').scrollIntoViewIfNeeded();
    await page.locator('#fig-03 [data-phase-step="3"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#fig-03').getAttribute('data-active-phase'), '3');
    assert.equal(await page.locator('body').getAttribute('data-story-playing'), 'false');
    await page.locator('#fig-03 [data-story-stance="open"]').click();
    assert.equal(await page.locator('#fig-03').getAttribute('data-current-stance'), 'open');
    assert.equal(await page.locator('#fig-03 [data-stance-content="semi"]:visible').count(), 0);
  });
  await check('实验室操作与控件键盘行为', async () => {
    await page.locator('#lab').scrollIntoViewIfNeeded();
    await page.waitForSelector('#lab-mount .lab__play');
    await page.locator('#lab-mount [data-stroke="backhand"]').click();
    await page.locator('#lab-mount [data-stance="open"]').click();
    await page.locator('#lab-mount [data-view="top"]').click();
    assert.equal(await page.locator('#lab-mount [data-view="top"]').getAttribute('aria-pressed'), 'true');
    const slider = page.locator('#lab-mount .timeline__input');
    await slider.fill('920');
    await slider.dispatchEvent('input');
    assert.match(await page.locator('.lab__phase-name').textContent(), /Contact/);
    await page.locator('#lab-mount [data-stance="neutral"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#lab-mount [data-stance="neutral"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lab__play').getAttribute('aria-pressed'), 'false');
  });
  await check('主题切换后刷新保持选择', async () => {
    await page.locator('[data-theme-toggle]').click();
    const choice = await page.locator('[data-theme-toggle]').getAttribute('data-choice');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-theme-toggle]').getAttribute('data-choice'), choice);
  });
  await check('三视图标注位于画布上方且有明确视角名称', async () => {
    await page.locator('#lab').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#lab-mount canvas')?.dataset.ready === 'true');
    assert.equal(await page.locator('.mini__label').count(), 3);
    assert.deepEqual((await page.locator('.mini__label').allTextContents()).map(t => t.trim()), ['Front', 'Side', 'Top']);
    assert.ok(await page.locator('.lab__minis').evaluate(e => Number(getComputedStyle(e).zIndex) > 0));
  });
  await check('手机目录可展开、Escape关闭并回到按钮', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('[data-menu-toggle]').click();
    assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-menu-toggle')), true);
  });
  await check('手机三视图展开真实显示三个小窗', async () => {
    await page.locator('#lab').scrollIntoViewIfNeeded();
    await page.waitForSelector('#lab-mount canvas');
    const toggle = page.locator('.lab__multi-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.lab__minis .mini').count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });
  await check('运行时控制台没有页面错误', async () => assert.deepEqual(errors, []));
  await check('平板断点的舞台不覆盖控制区，按钮可直接点击', async () => {
    for (const width of [768, 820, 960, 961, 1024, 1180]) {
      await page.setViewportSize({ width, height: 1180 });
      await page.waitForTimeout(180);
      const rects = await page.evaluate(() => {
        const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
        return { stage: rect('.lab__stage'), panel: rect('.lab__panel'), body: rect('.lab__body') };
      });
      assert.ok(rects.stage.right <= rects.body.right + 1, `宽度 ${width} 舞台越出容器`);
      if (width > 960) assert.ok(rects.stage.right <= rects.panel.left + 1, `宽度 ${width} 舞台覆盖控制区`);
      else assert.ok(rects.stage.bottom <= rects.panel.top + 1, `宽度 ${width} 舞台覆盖下方面板`);
      await page.locator('#lab-mount [data-stroke="forehand"]').click({ timeout: 3000 });
    }
  });
} finally {
  await writeFile(resolve(out, 'interaction-audit.json'), JSON.stringify({ base, checks, errors }, null, 2));
  await browser.close();
}
if (checks.some(item => !item.passed)) process.exitCode = 1;
