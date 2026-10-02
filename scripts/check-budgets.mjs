import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

// 用法：QA_ROUND=round-2 node scripts/check-budgets.mjs
const dist = resolve('dist');
const round = process.env.QA_ROUND ?? 'runtime';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(round)) throw new Error('QA_ROUND 格式不安全。');
const out = resolve(`artifacts/quality/${round}`);
const pageBase = '/outsider-01/';
const origin = 'https://local-build.invalid';
const limits = { initialJsGzip: 60 * 1024, allJsGzip: 350 * 1024, actualFirstScreenFonts: 300 * 1024, reportHtmlGzip: 50 * 1024 };
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async entry => {
  const file = resolve(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
}))).flat();
const files = await walk(dist);
const buffers = new Map(await Promise.all(files.map(async file => [file, await readFile(file)])));
const size = file => ({ file: relative(dist, file), bytes: buffers.get(file).length, gzipBytes: gzipSync(buffers.get(file)).length });
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(match => [match[1].toLowerCase(), (match[2] ?? match[3] ?? match[4]).replaceAll('&amp;', '&')]));
const isExternal = value => /^(?:https?:)?\/\//i.test(value);
const requests = [], ignoredNavigationAndMetadata = [], unresolvedCalls = [];

function resolveLocal(value, owner) {
  if (!value || /^(?:data:|blob:|#)/i.test(value) || isExternal(value)) return null;
  const base = `${origin}${pageBase}${relative(dist, owner).replaceAll('\\', '/')}`;
  const url = new URL(value, base);
  let path = decodeURIComponent(url.pathname);
  if (path.startsWith(pageBase)) path = path.slice(pageBase.length);
  else path = path.replace(/^\//, '');
  const file = resolve(dist, path);
  if (!file.startsWith(`${dist}/`)) throw new Error(`资源路径超出构建目录：${value}`);
  return file;
}

function request(value, file, kind) {
  if (!value || /^(?:data:|blob:|#)/i.test(value)) return;
  if (isExternal(value)) requests.push({ file: relative(dist, file), kind, url: value });
}

function scanHtml(text, file) {
  for (const match of text.matchAll(/<(script|link|img|source|video|audio|iframe|embed|object|a)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase(), attribute = attrs(match[0]);
    if (tag === 'a') { if (isExternal(attribute.href ?? '')) ignoredNavigationAndMetadata.push({ file: relative(dist, file), kind: 'navigation', url: attribute.href }); continue; }
    if (tag === 'link') {
      if (attribute['data-inline-style-for'] && /\sdisabled(?:\s|>|=)/i.test(match[0])) {
        const name = attribute['data-inline-style-for'];
        const path = resolveLocal(attribute.href, file);
        const source = path && buffers.get(path)?.toString('utf8');
        if (source && attribute.href === pageBase + name && text.includes(`<style data-report-style="${name}">${source.replace(/<\/style/gi, '<\\/style')}</style>`)) continue;
      }
      if (/^(?:canonical|alternate)$/i.test(attribute.rel ?? '')) {
        if (isExternal(attribute.href ?? '')) ignoredNavigationAndMetadata.push({ file: relative(dist, file), kind: attribute.rel, url: attribute.href });
        continue;
      }
      if (/(?:stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon)/i.test(attribute.rel ?? '')) request(attribute.href, file, `html-link-${attribute.rel}`);
    } else {
      request(attribute.src ?? attribute.data, file, `html-${tag}`);
      if (tag === 'video') request(attribute.poster, file, 'html-video-poster');
      if (attribute.srcset) for (const candidate of attribute.srcset.split(',')) request(candidate.trim().split(/\s+/)[0], file, 'html-srcset');
    }
  }
}

function scanCode(text, file) {
  // 只在真实网络 API/导入表达式上下文中提取 URL；不会把版权声明、SVG namespace、shader 文本中的 http 当请求。
  const literal = '(["\x27`])([^"\x27`\\n]*)\\1';
  const patterns = [
    ['fetch/request/socket', new RegExp(`\\b(?:fetch|Request|WebSocket|EventSource|Worker|SharedWorker)\\s*\\(\\s*${literal}`, 'g')],
    ['dynamic-import', new RegExp(`\\b(?:import|importScripts)\\s*\\(\\s*${literal}`, 'g')],
    ['beacon', new RegExp(`\\.sendBeacon\\s*\\(\\s*${literal}`, 'g')],
    ['xhr-open', /\.open\s*\(\s*["'`](?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)["'`]\s*,\s*(["'`])([^"'`\n]*)\1/g],
    ['static-import', /\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?(["'])([^"'\n]+)\1/g],
    ['resource-property', /\.(?:src|srcset|poster)\s*=\s*(["'`])([^"'`\n]*)\1/g],
    ['resource-attribute', /\.setAttribute\s*\(\s*["'](?:src|srcset|poster)["']\s*,\s*(["'`])([^"'`\n]*)\1/g],
  ];
  for (const [kind, pattern] of patterns) for (const match of text.matchAll(pattern)) request(match[2], file, kind);
  const dynamic = [...text.matchAll(/\b(?:fetch|Request|WebSocket|EventSource|Worker|SharedWorker)\s*\(\s*([^\s"'`][^,)\n]{0,100})/g)];
  if (dynamic.length) unresolvedCalls.push({ file: relative(dist, file), calls: dynamic.length, note: '参数动态产生；静态扫描不据此断言外联，需结合 runtime-performance 的真实请求记录。' });
}

const pages = [];
for (const entry of ['index.html', 'en/index.html']) {
  const file = resolve(dist, entry);
  const text = buffers.get(file)?.toString('utf8');
  if (!text) throw new Error(`找不到构建入口 ${entry}，请先运行构建。`);
  const initial = new Set();
  for (const match of text.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attribute = attrs(match[0]);
    const value = match[1].toLowerCase() === 'script' ? attribute.src : attribute.rel === 'modulepreload' ? attribute.href : null;
    if (!value) continue;
    const path = resolveLocal(value, file);
    if (!path) continue;
    if (!buffers.has(path)) throw new Error(`首页引用缺失资源：${entry} → ${value}`);
    initial.add(path);
  }
  const assets = [...initial].map(size);
  const gzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
  const htmlGzipBytes = gzipSync(text).length;
  const inlineStyles = [...text.matchAll(/<style\b[^>]*data-report-style=["'][^"']+["'][^>]*>([\s\S]*?)<\/style>/gi)];
  const styleLinks = [...text.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)];
  if (inlineStyles.length !== 2 || styleLinks.length !== 2) throw new Error(`报告首屏样式未按约定内联：${entry}`);
  for (const [tag] of styleLinks) {
    const attribute = attrs(tag);
    const name = attribute['data-inline-style-for'];
    const path = resolveLocal(attribute.href, file);
    const source = path && buffers.get(path)?.toString('utf8');
    if (!/\sdisabled(?:\s|>|=)/i.test(tag) || !name || !source || attribute.href !== pageBase + name ||
        !text.includes(`<style data-report-style="${name}">${source.replace(/<\/style/gi, '<\\/style')}</style>`)) {
      throw new Error(`禁用样式标记缺少对应完整内联内容：${entry}`);
    }
  }
  for (const [, css] of inlineStyles) for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
    const path = resolveLocal(match[1], file);
    if (path && !buffers.has(path)) throw new Error(`内联样式引用缺失资源：${entry} → ${match[1]}`);
  }
  pages.push({ entry, assets, gzipBytes, limit: limits.initialJsGzip, htmlGzipBytes, htmlLimit: limits.reportHtmlGzip,
    inlineStyles: inlineStyles.length, pass: gzipBytes <= limits.initialJsGzip && htmlGzipBytes <= limits.reportHtmlGzip });
}

for (const [file, buffer] of buffers) {
  const extension = extname(file);
  if (!['.html', '.css', '.js', '.mjs'].includes(extension)) continue;
  const text = buffer.toString('utf8');
  if (extension === '.html') scanHtml(text, file);
  if (extension === '.js' || extension === '.mjs') scanCode(text, file);
  // CSS url() 才是加载资源；HTML 的 canonical、书目和源代码超链接不在这里扫描。
  if (extension === '.css' || extension === '.html') {
    const css = extension === '.css' ? text : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
    for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) request(match[1], file, 'css-url');
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) request(match[1], file, 'css-import');
  }
}
const js = files.filter(file => /\.(?:m?js)$/.test(file)).map(size);
const allJsGzipBytes = js.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const fonts = files.filter(file => /\.(?:woff2?|ttf|otf)$/i.test(file)).map(file => ({ file: relative(dist, file), bytes: buffers.get(file).length }));
const uniqueRequests = [...new Map(requests.map(item => [`${item.file}:${item.kind}:${item.url}`, item])).values()];
const report = {
  round, createdAt: new Date().toISOString(), dist,
  method: '首屏预算按各入口 HTML 的 script[src] 与 modulepreload[href] 去重求和；gzip 使用 Node zlib 默认压缩等级。全部 JS 按每个独立产物 gzip 后求和。',
  limits, pages, allJs: { assets: js, gzipBytes: allJsGzipBytes, limit: limits.allJsGzip, pass: allJsGzipBytes <= limits.allJsGzip },
  fonts: { assets: fonts, packedBytes: fonts.reduce((sum, asset) => sum + asset.bytes, 0), note: '这是打包字体存量，不是用户首屏下载量；实际请求与传输请看同轮 runtime-performance.json。woff2 已压缩，不再次 gzip 后冒充网络节省。' },
  runtimeRequestScan: { externalLiteralRequests: uniqueRequests, pass: uniqueRequests.length === 0, unresolvedCalls, ignoredNavigationAndMetadata, limitation: '静态网络调用与资源上下文扫描，不是完整程序数据流证明；动态拼接 URL 由生产浏览器真实请求记录补充。第三方库许可证或 shader 中的裸 http 字符串不计为请求。' },
};
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'budget-report.json'), JSON.stringify(report, null, 2));
for (const page of pages) console.log(`${page.entry} 首屏 JS：${(page.gzipBytes / 1024).toFixed(1)} / 60 KB（gzip），${page.pass ? '通过' : '未通过'}。`);
for (const page of pages) console.log(`${page.entry} 正文与内联样式：${(page.htmlGzipBytes / 1024).toFixed(1)} / 50 KB（gzip）。`);
console.log(`全部 JS：${(allJsGzipBytes / 1024).toFixed(1)} / 350 KB（gzip），${report.allJs.pass ? '通过' : '未通过'}。`);
console.log(`打包字体共 ${fonts.length} 个、${(report.fonts.packedBytes / 1024).toFixed(1)} KB；首屏实际下载另看运行时报告。`);
console.log(`网络资源扫描：${uniqueRequests.length} 个第三方字面量请求；${unresolvedCalls.reduce((sum, item) => sum + item.calls, 0)} 处动态参数调用待运行时佐证。metadata 和普通外链不作网络请求。`);
console.log(`预算报告已写入 ${resolve(out, 'budget-report.json')}。`);
if (pages.some(page => !page.pass) || !report.allJs.pass || !report.runtimeRequestScan.pass) process.exitCode = 1;
