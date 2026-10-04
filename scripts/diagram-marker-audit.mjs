import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// 检查原型及正式页面的二维共用绘图；手机尺寸为桌面浏览器模拟。
const round = process.env.QA_ROUND ?? 'diagram-markers';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('无效的检查目录');
const out = resolve('artifacts/quality', round);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { round, pages: [], errors: [] };

try {
  for (const width of [1440, 375]) {
    for (const theme of ['light', 'dark']) {
      for (const variant of ['prototype', 'zh', 'en']) {
        const key = `${width}-${theme}-${variant}`;
        const context = await browser.newContext({
          viewport: { width, height: width === 1440 ? 900 : 812 }, colorScheme: theme,
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const proto = variant === 'prototype';
        const url = proto ? 'http://127.0.0.1:4175/'
          : `http://127.0.0.1:4173/outsider-01/${variant === 'en' ? 'en/' : ''}?force2d=1`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const stage = page.locator(proto ? '#fh-stage' : '#lab-root .lab__stage > svg');
        const diagram = stage.locator('[data-diagram="shoulder-hip"]');
        await diagram.waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await diagram.locator('circle').count(), 2, `${key}：只留边框和右肩点`);
        assert.equal(await diagram.locator('ellipse').count(), 2, `${key}：保留左右脚`);
        assert.equal(await diagram.locator('line').count(), 2, `${key}：保留肩髋轴线`);

        const input = page.locator(proto ? '#fh-t' : '#lab-root .timeline input');
        const setTime = value => input.evaluate((el, value) => {
          el.value = String(value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
        const initial = await diagram.innerHTML();
        const ground = stage.locator(':scope > circle[stroke-opacity="0.35"]');
        const pointBefore = await ground.evaluate(el => [el.getAttribute('cx'), el.getAttribute('cy')]);
        await setTime(proto ? 400 : 1220);
        assert.notEqual(await diagram.innerHTML(), initial, `${key}：时间轴驱动俯视图`);
        assert.notDeepEqual(await ground.evaluate(el => [el.getAttribute('cx'), el.getAttribute('cy')]), pointBefore,
          `${key}：脚下承重标记仍然随时间变化`);

        await setTime(proto ? 180 : 550);
        const play = page.locator(proto ? '#fh-play' : '#lab-root .lab__play');
        const paused = await diagram.innerHTML();
        await play.click();
        await page.waitForTimeout(250);
        await play.click();
        assert.notEqual(await diagram.innerHTML(), paused, `${key}：播放同步`);
        await setTime(proto ? 180 : 550);
        const bounds = await stage.evaluate(svg => {
          const stage = svg.getBoundingClientRect();
          return [...svg.querySelectorAll('[data-diagram] text')].map(text => {
            const box = text.getBoundingClientRect();
            return { label: text.textContent, inside: box.left >= stage.left - 1 && box.right <= stage.right + 1
              && box.top >= stage.top - 1 && box.bottom <= stage.bottom + 1 };
          });
        });
        assert.ok(bounds.every(label => label.inside), `${key}：俯视图文字和角度必须完整显示`);
        await stage.locator('..').scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(out, `${key}-stage.png`) });
        await diagram.screenshot({ path: resolve(out, `${key}-inset.png`) });

        let legend = null;
        if (proto) {
          const diagrams = page.locator('[data-diagram="shoulder-hip"]');
          assert.equal(await diagrams.count(), 6, '原型的五张卡片和主舞台均修复');
          for (const item of await diagrams.all()) assert.equal(await item.locator('circle').count(), 2);
          const keyEl = page.locator('.legend');
          const text = await keyEl.innerText();
          assert.ok(text.includes('脚下圆环中的实心点：承重位置（模型示意）'));
          assert.ok(text.includes('末端圆点标记右肩'));
          assert.ok(!text.includes('黑点') && !text.includes('白点'));
          legend = await page.evaluate(() => {
            const key = document.querySelector('.legend svg circle[fill="var(--text-primary)"]');
            const ring = document.querySelector('#fh-stage > circle[stroke-opacity="0.35"]');
            return { key: getComputedStyle(key).fill, ground: getComputedStyle(ring.nextElementSibling).fill };
          });
          assert.equal(legend.key, legend.ground, `${key}：图例和脚下标记同色`);
          await keyEl.screenshot({ path: resolve(out, `${key}-legend.png`) });
        }
        assert.equal(errors.length, 0, `${key}：浏览器脚本无错误`);
        report.pages.push({ key, url, passed: true, legend, bounds, errors });
        console.log(`已检查：${key}`);
        await context.close();
      }
    }
  }
} catch (error) {
  report.errors.push(String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(out, 'diagram-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
