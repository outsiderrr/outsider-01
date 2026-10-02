import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// 用本站原始模型线稿和字体生成分享图；不依赖外部图片服务。
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(resolve('public/share'), { recursive: true });
try {
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(`${base}${lang === 'en' ? 'en/' : ''}?force2d=1`, { waitUntil: 'networkidle' });
    await page.evaluate(lang => {
      const figure = document.querySelector('[data-phase-figure="forehand-semi-contact"] svg').outerHTML;
      document.body.innerHTML = `<div class="share"><div class="copy"><p class="overline">OUTSIDER · 01 / ${lang === 'zh' ? '实验报告' : 'LAB REPORT'}</p><h1>${lang === 'zh' ? '网球挥拍<br>实验报告<span>。</span>' : 'A Tennis Swing<br>Lab Report<span>.</span>'}</h1><p class="lead">${lang === 'zh' ? '正手与双手反手<br>三种站位，五个阶段。' : 'Forehand & two-handed backhand.<br>Three stances. Five phases.'}</p><p class="note">${lang === 'zh' ? '可旋转的 3D 示意模型 · 中英双语' : 'An interactive 3D model · 中文 / English'}</p></div><div class="drawing">${figure}<p>${lang === 'zh' ? '模型示意，非实测或动作标准' : 'An illustration, not a measurement or a technical standard'}</p></div></div>`;
      const style = document.createElement('style');
      style.textContent = `.share{width:1200px;height:630px;display:grid;grid-template-columns:610px 470px;gap:20px;padding:50px;background:var(--paper);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:24px 24px}.overline{color:var(--signal-text);font:13px var(--font-mono);letter-spacing:.1em}.share h1{font-size:${lang === 'zh' ? '78' : '80'}px;line-height:1.12;letter-spacing:-.04em;margin:40px 0 22px}.share h1 span{color:var(--signal)}.lead{font-size:22px;line-height:1.55;color:var(--text-2)}.note{font:12px var(--font-mono);margin-top:28px;border-top:1px solid var(--line-strong);padding-top:18px}.drawing{align-self:center;border:1px solid var(--line-strong);background:var(--paper);padding:12px}.drawing svg{width:100%;height:420px}.drawing p{font:10px var(--font-mono);color:var(--text-2);border-top:1px solid var(--line-strong);padding-top:12px}`;
      document.head.append(style);
    }, lang);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(`public/share/report-${lang}.png`) });
    await page.close();
    console.log(`已生成 ${lang === 'zh' ? '中文' : '英文'}分享图（1200×630）`);
  }
} finally { await browser.close(); await server.close(); }
