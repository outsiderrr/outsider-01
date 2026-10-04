# 阿里云二维原型部署

## 本次发布范围

用户于 2026-10-04 授权使用现有阿里云 8G 服务器，并明确选择当前 4175 预览的**中文二维正手原型**。发布源是 `reference/prototype-forehand.html`；完整中英三维网站不包含在本次发布中。此次授权不涉及 GitHub 建仓、推送或 Pages。

- 计划入口：`https://8.209.239.47/outsider-01/`。
- 主机：东京阿里云，`admin@8.209.239.47`；2026-10-04 只读实查为 4 核、系统可用总内存约 7.1 GiB、根盘剩余 49 GiB。
- 独立应用目录：`/opt/outsider-01`；独立容器名：`outsider01-static`。
- 共享 HTTPS 入口：`see-me-caddy-1`，宿主机配置 `/opt/see-me/Caddyfile`，只读单文件绑定到容器 `/etc/caddy/Caddyfile`。
- 现有英语应用、`fathomlog.com`、数据库、证书和续期机制保留。仅为 `/outsider-01` 与 `/outsider-01/*` 增加精确路由。

书目的出版社、译者和年份仍待版权页照片核对；已在发布准备时提醒用户。本次原型只保留现有书名引用，不补写未核实书目信息。图示角度、承重和动作属于示意，页面保留原型说明。

## 构建与预检

```bash
npx tsc --noEmit
npx vitest run
npm run build:prototype
```

产物为 `artifacts/releases/prototype/`：HTML、内容哈希命名的 CSS/JS 及 SHA-256 清单。部署只上传这些显式构建文件；不上传仓库、`node_modules`、环境配置或私钥。

原型的动态脚本保持原内容。生产包装补上文档语言、手机视口和页面描述，将脚本及样式改成同源文件，去除 Google Fonts 请求，沿用声明中的系统字体回退。两种主题和三个站位均做浏览器检查。原型没有英文版，不把完整站点英文页面计为本次发布内容。

## 发布隔离与配置

- 发布文件保存在 `/opt/outsider-01/releases/<发布编号>/`，`current` 为相对符号链接，可切回历史目录。
- 静态服务基于服务器已经存在的 Caddy 镜像摘要，`deploy/Dockerfile.static` 只移除二进制低端口绑定权限，生成本站专用镜像。本站只监听 8080，可以使用非 root 用户、只读文件系统、移除全部 Linux capabilities 和禁止新增权限；不发布宿主机端口，只加入既有 `see-me_default` 网络。
- `deploy/Caddyfile.static` 是本站容器配置：管理接口与自动证书关闭；只接受 GET/HEAD；脚本限同源、网络接口关闭；HTML 每次校验，哈希资源长期缓存；构建清单不对外提供。
- `deploy/Caddyfile.route` 是插入现有 IP HTTPS 块的新增片段，**不是全量共享配置**。先复制当前配置，再加入片段；移除该片段后必须与原始配置逐字相同。
- 保存变更前完整配置和 SHA-256。应用前检查远端配置哈希仍一致，避免覆盖其他会话的改动；先验证候选配置，再保留原文件 inode 写回，确认容器看到同一内容后平滑 reload。单文件绑定不可用原子替换宿主机文件，否则容器可能继续读旧 inode。[Caddy 配置重载](https://caddyserver.com/docs/command-line#caddy-reload)
- 保留既有 HTTPS 证书及原路由，不重建共享 Caddy、不重启其他应用、不改安全组或 DNS。

## 访问验证与回退

上线前后分别记录共享 Caddy 和既有应用的容器 ID、启动时间；检查英语应用 `/health`、Fathom `/health`、两个原首页内容。公网网球页必须验证受信任 TLS、HTTP 状态、资源哈希、三站位、播放/暂停、时间轴、俯视图与承重指示同步；同时检查错误路径、构建清单、写入请求不会暴露额外内容。

若首次发布需撤销：校验并原样恢复备份的共享 Caddyfile，确认容器内外一致后 reload；然后停止本项目的 `outsider01-static`。保留发布目录和备份。后续更新优先切回 `current` 的旧目标。不要删除任何共享卷或对其他项目执行 `docker compose down`。

## 本机连接注意事项

当前默认路由经过 `utun4`，SSH 会在 banner 阶段超时。2026-10-04 使用 `ssh -B en0` 与 `scp -o BindInterface=en0` 成功连接；此设置仅作用于当次进程，不改系统路由。另一台电脑先确认自己的物理网卡名称。公网核验可用 `curl --interface en0`；浏览器若受本机代理影响，可使用临时 SSH SOCKS 隧道访问真实 HTTPS，保持正常证书校验，并明确记录该验证路径。

## 发布记录

尚在发布准备阶段；执行成功后补记发布编号、校验清单、备份路径及线上验收结果。
