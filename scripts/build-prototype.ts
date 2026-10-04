import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = 'reference/prototype-forehand.html';
const assetNamePattern = /^prototype\.[a-f0-9]{16}\.(?:css|js)$/;

export interface PrototypeManifest {
  schemaVersion: 1;
  gitRevision: string | null;
  source: { path: string; sha256: string; bytes: number };
  /** The manifest describes the deployable resources; it does not hash itself. */
  files: { path: string; sha256: string; bytes: number }[];
}

export interface PrototypeRelease {
  files: Record<string, string>;
  manifest: PrototypeManifest;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function metadata(path: string, content: string) {
  return { path, sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8') };
}

function extractOne(source: string, tag: 'style' | 'script' | 'title'): string {
  const matches = [...source.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi'))];
  if (matches.length !== 1) throw new Error(`原型必须包含一个无属性的 ${tag} 元素`);
  return matches[0][1];
}

/** Build only the accepted standalone prototype. No bundling, imports, or filesystem access. */
export function buildPrototype(source: string, options: { gitRevision?: string } = {}): PrototypeRelease {
  const gitRevision = options.gitRevision ?? null;
  if (gitRevision !== null && !/^[a-f0-9]{7,64}$/i.test(gitRevision)) {
    throw new Error('gitRevision 必须是 7–64 位十六进制提交标识');
  }
  const css = extractOne(source, 'style');
  const javascript = extractOne(source, 'script');
  const title = extractOne(source, 'title');
  if (/[<>]/.test(title)) throw new Error('原型标题必须是纯文本');

  const body = source
    .replace(/<style>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<script>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<meta\s+charset=["']utf-8["']\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, (link) => {
      const href = link.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (href && /^https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/|$)/i.test(href)) return '';
      throw new Error('原型存在未打包的 link 资源');
    })
    .trim();

  // The accepted prototype is self-contained. Stop if a future edit adds resources
  // or networking instead of silently publishing an incomplete/off-origin page.
  if (/<(?:!doctype|html|head|body|meta|title|link|style|script|base|iframe|object|embed)\b/i.test(body)) {
    throw new Error('原型存在未处理的文档或资源元素');
  }
  if (/\b(?:src|srcset|href|action|poster)\s*=/i.test(body + javascript)
    || /(?:https?|wss?):\/\/|\b(?:fetch|importScripts|WebSocket|EventSource|XMLHttpRequest|Worker|SharedWorker)\s*\(|\b(?:import|sendBeacon)\s*\(/i.test(css + body + javascript)
    || /@import\b|url\s*\(/i.test(css)) {
    throw new Error('原型包含外部资源或网络请求；请先将其纳入明确的部署范围');
  }

  const cssPath = `assets/prototype.${sha256(css).slice(0, 16)}.css`;
  const jsPath = `assets/prototype.${sha256(javascript).slice(0, 16)}.js`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="通过五个动作阶段和慢动作动画，学习网球右手正手的半开放式、中性与开放式站位。">
<title>${title}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="./${cssPath}">
<script src="./${jsPath}" defer></script>
</head>
<body>
${body}
</body>
</html>
`;
  const files: Record<string, string> = { 'index.html': html, [cssPath]: css, [jsPath]: javascript };
  const manifest: PrototypeManifest = {
    schemaVersion: 1,
    gitRevision,
    source: metadata(sourcePath, source),
    files: Object.entries(files).map(([path, content]) => metadata(path, content)),
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { files, manifest };
}

/** Refuse unrelated files and symlinks; replace only this builder's known outputs. */
export function writePrototypeRelease(outputDirectory: string, release: PrototypeRelease): void {
  const expectedPaths = ['index.html', 'manifest.json', ...release.manifest.files
    .filter((file) => file.path.startsWith('assets/')).map((file) => file.path)];
  if (expectedPaths.length !== 4 || Object.keys(release.files).length !== 4
    || expectedPaths.some((path) => !(path in release.files))
    || expectedPaths.slice(2).some((path) => !/^assets\/prototype\.[a-f0-9]{16}\.(?:css|js)$/.test(path))) {
    throw new Error('部署包只能包含 index.html、manifest.json 和两份哈希命名的 CSS/JS');
  }
  if (existsSync(outputDirectory)) {
    if (!lstatSync(outputDirectory).isDirectory() || lstatSync(outputDirectory).isSymbolicLink()) {
      throw new Error('部署输出必须是独立的普通目录');
    }
    for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
      const allowedFile = ['index.html', 'manifest.json'].includes(entry.name) && entry.isFile();
      if (!allowedFile && !(entry.name === 'assets' && entry.isDirectory())) {
        throw new Error(`部署目录包含非构建文件，已停止：${entry.name}`);
      }
    }
  }
  const assetsDirectory = join(outputDirectory, 'assets');
  if (existsSync(assetsDirectory)) {
    for (const entry of readdirSync(assetsDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !assetNamePattern.test(entry.name)) {
        throw new Error(`部署资源目录包含非构建文件，已停止：${entry.name}`);
      }
    }
  }
  mkdirSync(assetsDirectory, { recursive: true });
  for (const [path, content] of Object.entries(release.files)) {
    if (path !== 'index.html') writeFileSync(join(outputDirectory, path), content, 'utf8');
  }
  writeFileSync(join(outputDirectory, 'index.html'), release.files['index.html'], 'utf8');
  for (const entry of readdirSync(assetsDirectory)) {
    if (!(`assets/${entry}` in release.files)) unlinkSync(join(assetsDirectory, entry));
  }
}

function main(args: string[]): void {
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--git-revision')) {
    throw new Error('用法：npm run build:prototype -- [--git-revision <commit-sha>]');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const gitRevision = args[1] ?? execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: root, encoding: 'utf8',
  }).trim();
  const release = buildPrototype(readFileSync(join(root, sourcePath), 'utf8'), { gitRevision });
  const outputDirectory = join(root, 'artifacts/releases/prototype');
  writePrototypeRelease(outputDirectory, release);
  const bytes = Object.values(release.files).reduce((total, content) => total + Buffer.byteLength(content, 'utf8'), 0);
  process.stdout.write(`二维原型部署包：${outputDirectory}\n${Object.keys(release.files).length} 个文件，${bytes} 字节，版本 ${gitRevision}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
