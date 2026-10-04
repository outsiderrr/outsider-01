import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = new URL('https://8.209.239.47/outsider-01/');
const out = resolve('artifacts/quality/prototype-release-online');
mkdirSync(out, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base: base.href, checks: [] };
const sha = data => createHash('sha256').update(data).digest('hex');

function request(url, method = 'GET', args = []) {
  const marker = '\n__OUTSIDER_HTTP__';
  const raw = execFileSync('curl', [
    '--silent', '--show-error', '--compressed', '--noproxy', '*', '--max-time', '15',
    ...(process.env.QA_INTERFACE ? ['--interface', process.env.QA_INTERFACE] : []),
    '--request', method, '--dump-header', '-', '--write-out', `${marker}%{http_code} %{ssl_verify_result}`,
    ...args, url,
  ], { maxBuffer: 2 * 1024 * 1024 });
  const split = raw.indexOf('\r\n\r\n');
  const trailer = raw.lastIndexOf(marker);
  assert.ok(split > 0 && trailer > split, 'HTTP 响应包含完整标头与校验结果');
  const [status, tls] = raw.subarray(trailer + marker.length).toString().split(' ').map(Number);
  assert.equal(tls, 0, '使用系统信任库校验服务器证书');
  const headers = Object.fromEntries(raw.subarray(0, split).toString().split('\r\n').slice(1)
    .map(line => [line.slice(0, line.indexOf(':')).toLowerCase(), line.slice(line.indexOf(':') + 1).trim()]));
  return { url, method, status, tls, headers, body: raw.subarray(split + 4, trailer) };
}

function record(response, name) {
  report.checks.push({ name, url: response.url, method: response.method, status: response.status,
    tls: response.tls, headers: response.headers, bytes: response.body.length, sha256: sha(response.body) });
}

try {
  const manifest = JSON.parse(readFileSync('artifacts/releases/prototype/manifest.json', 'utf8'));
  for (const file of manifest.files) {
    const url = new URL(file.path === 'index.html' ? './' : file.path, base).href;
    const response = request(url);
    assert.equal(response.status, 200);
    assert.equal(response.body.length, file.bytes);
    assert.equal(sha(response.body), file.sha256, '线上文件与版本清单一致');
    assert.equal(response.headers['cache-control'], file.path === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
    assert.ok(response.headers['content-security-policy'].includes("connect-src 'none'"));
    record(response, `发布文件校验：${file.path}`);
  }
  const redirect = request('https://8.209.239.47/outsider-01');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/outsider-01/');
  record(redirect, '目录入口补齐斜杠');
  for (const path of ['manifest.json', '.env', '.git/config', 'missing-check.css']) {
    const response = request(new URL(path, base).href);
    assert.equal(response.status, 404);
    record(response, `不公开路径：${path}`);
  }
  const write = request(base.href, 'POST');
  assert.equal(write.status, 405);
  record(write, '静态服务拒绝写入方法');

  const english = request('https://8.209.239.47/health');
  assert.equal(english.status, 200);
  assert.equal(JSON.parse(english.body).status, 'ok');
  record(english, '原英语应用健康检查');
  const fathom = request('https://fathomlog.com/health', 'GET', ['--resolve', 'fathomlog.com:443:8.209.239.47']);
  assert.equal(fathom.status, 200);
  assert.equal(JSON.parse(fathom.body).ok, true);
  record(fathom, '原 Fathom 应用健康检查');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error);
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'http-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error }));
}
