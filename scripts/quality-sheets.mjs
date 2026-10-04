import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder = resolve(process.argv[2] ?? 'artifacts/quality/round-1');
const auditFile = process.argv[3] ?? 'browser-audit.json';
if (!['browser-audit.json', 'lab-home-audit.json'].includes(auditFile)) throw new Error('未知的截图检查清单');
const audit = JSON.parse(await readFile(resolve(folder, auditFile), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const config of audit.pages) {
    const key = `${config.device}-${config.theme}-${config.lang}`;
    const thumbs = await Promise.all(config.shots.map(async file => `<figure><figcaption>${file.replace(key + '-', '').replace('.png', '')}</figcaption><img src="data:image/png;base64,${(await readFile(resolve(folder, file))).toString('base64')}" /></figure>`));
    const width = config.device === 'desktop' ? 1440 : 1500;
    const columns = config.device === 'desktop' ? 3 : 4;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<html><head><style>body{margin:0;background:#ddd;font:14px monospace}main{display:grid;grid-template-columns:repeat(${columns},1fr);gap:3px}figure{margin:0}figcaption{padding:6px;background:#172a4b;color:white}img{width:100%;display:block}</style></head><body><main>${thumbs.join('')}</main></body></html>`);
    await page.screenshot({ path: resolve(folder, `${key}-sheet.png`), fullPage: true });
    await page.close();
    console.log(`已生成检查索引：${key}`);
  }
} finally { await browser.close(); }
