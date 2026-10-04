import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const staticConfig = readFileSync(new URL('../deploy/Caddyfile.static', import.meta.url), 'utf8');
const route = readFileSync(new URL('../deploy/Caddyfile.route', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../deploy/Dockerfile.static', import.meta.url), 'utf8');

describe('二维原型部署隔离配置', () => {
  it('固定基础镜像并移除低端口权限，以非root身份提供静态文件', () => {
    expect(dockerfile).toMatch(/FROM caddy@sha256:[a-f0-9]{64}/);
    expect(dockerfile).toContain('RUN setcap -r /usr/bin/caddy');
    expect(dockerfile).toContain('USER 10001:10001');
  });
  it('静态服务只读发布目录，关闭管理和自动证书，不作为共享代理替代品', () => {
    expect(staticConfig).toContain('root * /srv/current');
    expect(staticConfig).toContain('admin off');
    expect(staticConfig).toContain('auto_https off');
    expect(staticConfig).toContain('persist_config off');
    expect(staticConfig).toContain('hide manifest.json');
    expect(staticConfig).not.toContain('reverse_proxy');
  });
  it('脚本仅同源，静态站不需要联网接口或写入方法', () => {
    expect(staticConfig).toContain("script-src 'self';");
    expect(staticConfig).toContain("connect-src 'none';");
    expect(staticConfig).toContain('@read method GET HEAD');
    expect(staticConfig).toContain('respond "Method Not Allowed" 405');
  });
  it('HTML每次校验，内容哈希资源独立长期缓存', () => {
    expect(staticConfig).toContain('Cache-Control no-cache');
    expect(staticConfig).toContain('@assets path /assets/*');
    expect(staticConfig).toContain('header @assets Cache-Control "public, max-age=31536000, immutable"');
  });
  it('入口仅匹配独立子路径，原应用根路径和接口继续由原配置处理', () => {
    expect(route).toContain('redir /outsider-01 /outsider-01/ 308');
    expect(route).toContain('handle_path /outsider-01/*');
    expect(route).toContain('reverse_proxy outsider01-static:8080');
    expect(route).not.toContain('handle_path /*');
    expect(route).not.toContain('englishcoach-api');
    expect(route).not.toContain('fathomlog.com');
  });
});
