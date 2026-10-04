import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPrototype, writePrototypeRelease } from '../scripts/build-prototype';

const source = readFileSync(new URL('../reference/prototype-forehand.html', import.meta.url), 'utf8');
const revision = '0123456789abcdef0123456789abcdef01234567';
const checksum = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex');
const asset = (files: Record<string, string>, extension: string) => Object.keys(files).find((path) => path.endsWith(extension))!;
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'outsider-prototype-build-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('二维原型独立生产包', () => {
  it('输出标准中文文档、移动端 viewport 和说明', () => {
    const html = buildPrototype(source).files['index.html'];
    expect(html).toMatch(/^<!doctype html>\n<html lang="zh-CN">\n<head>/);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<meta name="description" content="通过五个动作阶段');
    expect(html).toContain('<title>网球正手三种站位</title>');
    expect(html).toContain('</head>\n<body>');
    expect(html).toMatch(/<\/body>\n<\/html>\n$/);
    for (const tag of ['html', 'head', 'body', 'title']) expect(html.match(new RegExp(`<${tag}(?:>| )`, 'g'))).toHaveLength(1);
  });

  it('使用同源相对哈希资源，并在 head 中 defer 执行脚本', () => {
    const { files } = buildPrototype(source);
    const css = asset(files, '.css'), javascript = asset(files, '.js');
    expect(css).toMatch(/^assets\/prototype\.[a-f0-9]{16}\.css$/);
    expect(javascript).toMatch(/^assets\/prototype\.[a-f0-9]{16}\.js$/);
    const html = files['index.html'];
    expect(html).toContain(`<link rel="stylesheet" href="./${css}">`);
    expect(html).toContain(`<script src="./${javascript}" defer></script>`);
    expect(html.indexOf('<script ')).toBeLessThan(html.indexOf('</head>'));
    expect(html).not.toMatch(/<style\b|<script>/);
    const requests = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    expect(requests).toEqual(['data:,', `./${css}`, `./${javascript}`]);
    for (const request of requests.filter((url) => !url.startsWith('data:'))) expect(new URL(request, 'https://example.test/outsider-01/').pathname).toBe(`/outsider-01/${request.slice(2)}`);
  });

  it('以空 favicon 数据地址阻止浏览器额外请求根目录图标', () => {
    const html = buildPrototype(source).files['index.html'];
    expect(html).toContain('<link rel="icon" href="data:,">');
    expect(html.indexOf('<link rel="icon"')).toBeLessThan(html.indexOf('</head>'));
    expect(html).not.toContain('favicon.ico');
  });

  it('逐字保留原动作脚本、样式和全部正文，仅删除头部外链', () => {
    const { files } = buildPrototype(source);
    expect(files[asset(files, '.js')]).toBe(source.match(/<script>([\s\S]*?)<\/script>/)![1]);
    expect(files[asset(files, '.css')]).toBe(source.match(/<style>([\s\S]*?)<\/style>/)![1]);
    const originalBody = source.slice(source.indexOf('<div class="wrap">'), source.indexOf('<script>')).trim();
    expect(files['index.html'].match(/<body>\n([\s\S]*)\n<\/body>/)![1]).toBe(originalBody);
    expect(files['index.html']).toContain('style="font-weight:500;font-size:15px"');
    expect(files[asset(files, '.js')]).toContain("document.getElementById('fh-w').style.left");
  });

  it('移除 Google Fonts 外链，保留系统字体回退且无第三方请求', () => {
    const { files } = buildPrototype(source);
    for (const content of Object.values(files)) {
      expect(content).not.toMatch(/https?:\/\/|fonts\.googleapis|fonts\.gstatic|@import\b|\bfetch\s*\(|XMLHttpRequest|WebSocket/);
    }
    const css = files[asset(files, '.css')];
    expect(css).toContain('"Songti SC","STSong",serif');
    expect(css).toContain('"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  });

  it('清单记录源文件、版本、资源完整 SHA-256 与 UTF-8 字节数', () => {
    const { files, manifest } = buildPrototype(source, { gitRevision: revision });
    expect(manifest.gitRevision).toBe(revision);
    expect(manifest.source).toEqual({ path: 'reference/prototype-forehand.html', sha256: checksum(source), bytes: Buffer.byteLength(source, 'utf8') });
    expect(manifest.files).toHaveLength(3);
    for (const entry of manifest.files) {
      expect(entry.sha256).toBe(checksum(files[entry.path]));
      expect(entry.bytes).toBe(Buffer.byteLength(files[entry.path], 'utf8'));
      if (entry.path.startsWith('assets/')) expect(entry.path).toContain(entry.sha256.slice(0, 16));
    }
    expect(JSON.parse(files['manifest.json'])).toEqual(manifest);
    expect(buildPrototype(source).manifest.gitRevision).toBeNull();
  });

  it('输出可重现，内容变化只改变对应资源的哈希名称', () => {
    const initial = buildPrototype(source, { gitRevision: revision });
    expect(buildPrototype(source, { gitRevision: revision })).toEqual(initial);
    const changedScript = buildPrototype(source.replace("let cur='semi'", "let cur='neutral'"));
    expect(asset(changedScript.files, '.js')).not.toBe(asset(initial.files, '.js'));
    expect(asset(changedScript.files, '.css')).toBe(asset(initial.files, '.css'));
    const changedStyle = buildPrototype(source.replace('--bg:#F3F5F1', '--bg:#F3F5F2'));
    expect(asset(changedStyle.files, '.css')).not.toBe(asset(initial.files, '.css'));
    expect(asset(changedStyle.files, '.js')).toBe(asset(initial.files, '.js'));
    expect(buildPrototype(source, { gitRevision: 'abcdef0' }).files[asset(initial.files, '.js')]).toBe(initial.files[asset(initial.files, '.js')]);
  });

  it('部署包只含 HTML、CSS、JS 和清单，完整原型与源码目录不进入产物', () => {
    const { files } = buildPrototype(source);
    expect(Object.keys(files).sort()).toEqual([
      asset(files, '.css'), asset(files, '.js'), 'index.html', 'manifest.json',
    ].sort());
    expect(Object.keys(files).join('\n')).not.toMatch(/\.env|\.git|\.map|\.pem|\.key|package|reference|node_modules/);
    expect(() => buildPrototype(source, { gitRevision: '<unsafe>' })).toThrow('gitRevision');
  });

  it.each([
    '<link rel="stylesheet" href="https://example.test/style.css">',
    '<img src="./.env">',
    '<iframe></iframe>',
  ])('拒绝未打包的资源或嵌入元素：%s', (addition) => {
    expect(() => buildPrototype(source + addition)).toThrow();
  });

  it.each([
    'fetch("/api")',
    'new WebSocket("wss://example.test")',
    'navigator.sendBeacon("/api")',
    'import("./another.js")',
  ])('拒绝新增网络请求：%s', (addition) => {
    expect(() => buildPrototype(source.replace('<script>', `<script>${addition};`))).toThrow('网络请求');
  });

  it('要求唯一脚本与样式，避免静默丢失新加入的内容', () => {
    expect(() => buildPrototype(source + '<script>example()</script>')).toThrow('script');
    expect(() => buildPrototype(source + '<style>body{}</style>')).toThrow('style');
    expect(() => buildPrototype(source.replace('<script>', '<script type="module">'))).toThrow('script');
    expect(() => buildPrototype(source.replace('<style>', '<style>@import "./another.css";'))).toThrow('网络请求');
  });

  it('写入独立目录并仅清理过时的生成资源', () => {
    const output = join(temporaryDirectory(), 'release');
    const first = buildPrototype(source);
    writePrototypeRelease(output, first);
    const second = buildPrototype(source.replace('--bg:#F3F5F1', '--bg:#F3F5F2'));
    writePrototypeRelease(output, second);
    expect(readdirSync(output).sort()).toEqual(['assets', 'index.html', 'manifest.json']);
    expect(readdirSync(join(output, 'assets')).sort()).toEqual([asset(second.files, '.css').slice(7), asset(second.files, '.js').slice(7)].sort());
    for (const [path, content] of Object.entries(second.files)) expect(readFileSync(join(output, path), 'utf8')).toBe(content);
  });

  it('发现额外文件即停止，保留该文件并阻止它混入部署包', () => {
    const output = temporaryDirectory();
    writeFileSync(join(output, '.env'), 'TEST_SENTINEL=not-a-real-secret');
    expect(() => writePrototypeRelease(output, buildPrototype(source))).toThrow('非构建文件');
    expect(readdirSync(output)).toEqual(['.env']);
    expect(readFileSync(join(output, '.env'), 'utf8')).toBe('TEST_SENTINEL=not-a-real-secret');
  });

  it('拒绝符号链接资源目录，防止写出部署目录', () => {
    const directory = temporaryDirectory(), output = join(directory, 'release'), elsewhere = join(directory, 'elsewhere');
    mkdirSync(output); mkdirSync(elsewhere);
    symlinkSync(elsewhere, join(output, 'assets'), 'dir');
    expect(() => writePrototypeRelease(output, buildPrototype(source))).toThrow('非构建文件');
    expect(readdirSync(elsewhere)).toEqual([]);
  });
});
