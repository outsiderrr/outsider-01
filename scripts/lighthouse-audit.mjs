import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.QA_URL ?? 'http://127.0.0.1:4173/outsider-01/';
const round = process.env.QA_ROUND ?? 'round-2';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('无效的检查目录');
const out = resolve('artifacts/quality', round);
await mkdir(out, { recursive: true });
const results = [];
// 四次串行测量；请勿与截图、构建或帧率测试同时运行。
for (const lang of ['zh', 'en']) for (const theme of ['light', 'dark']) {
  const output = resolve(out, `lighthouse-${lang}-${theme}.json`);
  await new Promise((done, reject) => {
    const process = spawn('node', ['node_modules/lighthouse/cli/index.js', base + (lang === 'en' ? 'en/' : ''),
      `--chrome-flags=--headless${theme === 'dark' ? ' --force-dark-mode' : ''}`,
      '--only-categories=performance,accessibility,best-practices,seo', '--output=json', `--output-path=${output}`, '--quiet'], { stdio: 'inherit' });
    process.on('error', reject);
    process.on('exit', code => code === 0 ? done() : reject(new Error(`性能检查退出码 ${code}`)));
  });
  const report = JSON.parse(await readFile(output, 'utf8'));
  const scores = Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, Math.round(category.score * 100)]));
  const lcp = report.audits['largest-contentful-paint'].numericValue;
  const cls = report.audits['cumulative-layout-shift'].numericValue;
  const passed = scores.performance >= 85 && scores.accessibility >= 95 && scores['best-practices'] >= 95 && scores.seo >= 95 && lcp <= 2500 && cls <= .1;
  results.push({ lang, theme, scores, lcpMs: lcp, cls, passed, report: output, environment: report.environment, settings: report.configSettings });
  console.log(`${lang === 'zh' ? '中文' : '英文'} / ${theme === 'light' ? '浅色' : '深色'}：${JSON.stringify(scores)}，LCP ${(lcp / 1000).toFixed(2)} 秒，CLS ${cls.toFixed(3)}，${passed ? '通过' : '未达标'}`);
  await writeFile(resolve(out, 'lighthouse-summary.json'), JSON.stringify(results, null, 2));
}
if (results.some(result => !result.passed)) process.exitCode = 1;
