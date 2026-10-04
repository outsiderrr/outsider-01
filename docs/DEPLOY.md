# 阿里云二维原型部署

## 本次发布范围

用户于 2026-10-04 授权使用现有阿里云 8G 服务器，并明确选择当前 4175 预览的**中文二维正手原型**。发布源是 `reference/prototype-forehand.html`；完整中英三维网站不包含在本次发布中。此次授权不涉及 GitHub 建仓、推送或 Pages。

- 已上线入口：`https://8.209.239.47/outsider-01/`。
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
- 本站容器限制为 128 MiB 内存、0.5 CPU、64 个进程，日志最多两份、每份 2 MiB，重启策略为 `unless-stopped`。`/data` 使用 16 MiB 的临时内存文件系统（UID/GID 10001、0700、nosuid/nodev/noexec），供 Caddy 写自身存储维护元数据；本站自动证书关闭，该临时目录不存放共享 HTTPS 证书。
- `deploy/Caddyfile.route` 是插入现有 IP HTTPS 块的新增片段，**不是全量共享配置**。先复制当前配置，再加入片段；移除该片段后必须与原始配置逐字相同。
- 保存变更前完整配置和 SHA-256。应用前检查远端配置哈希仍一致，避免覆盖其他会话的改动；先验证候选配置，再保留原文件 inode 写回，确认容器看到同一内容后平滑 reload。单文件绑定不可用原子替换宿主机文件，否则容器可能继续读旧 inode。[Caddy 配置重载](https://caddyserver.com/docs/command-line#caddy-reload)
- 保留既有 HTTPS 证书及原路由，不重建共享 Caddy、不重启其他应用、不改安全组或 DNS。

## 访问验证与回退

上线前后分别记录共享 Caddy 和既有应用的容器 ID、启动时间；检查英语应用 `/health`、Fathom `/health`、两个原首页内容。公网网球页必须验证受信任 TLS、HTTP 状态、资源哈希、三站位、播放/暂停、时间轴、俯视图与承重指示同步；同时检查错误路径、构建清单、写入请求不会暴露额外内容。

若首次发布需撤销：校验并原样恢复备份的共享 Caddyfile，确认容器内外一致后 reload；然后停止本项目的 `outsider01-static`。保留发布目录和备份。后续更新优先切回 `current` 的旧目标。不要删除任何共享卷或对其他项目执行 `docker compose down`。

本次原配置备份为 `/opt/outsider-01/backups/20261004T062717Z-e9ccc2a/Caddyfile.before`，SHA-256 为 `d5cb8b6ee91648cf6c3d43f37c5bd827480fd6c41c872422c2e143a4c82f2d19`。恢复前先核对现有共享配置是否出现后续变更；有后续变更时，只撤销本站标记片段并保留其他改动。使用 `cp` 写入既有文件以保留 inode，验证后执行 `docker exec see-me-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile --force`。此次已保存并核验备份，未实际执行线上回退演练。

## 本机连接注意事项

当前默认路由经过 `utun4`，SSH 会在 banner 阶段超时。2026-10-04 使用 `ssh -B en0` 与 `scp -o BindInterface=en0` 成功连接；此设置仅作用于当次进程，不改系统路由。另一台电脑先确认自己的物理网卡名称。公网核验可用 `curl --interface en0`；浏览器若受本机代理影响，可使用临时 SSH SOCKS 隧道访问真实 HTTPS，保持正常证书校验，并明确记录该验证路径。

## 发布记录

2026-10-04 已发布，最终公网复验于北京时间约 14:35 完成。

- 发布编号：`20261004T062717Z-e9ccc2a`；页面构建提交：`e9ccc2aa60346638389d77d0429f449caff0c4c1`。
- 发布目录：`/opt/outsider-01/releases/20261004T062717Z-e9ccc2a/`；`/opt/outsider-01/current` 指向相对路径 `releases/20261004T062717Z-e9ccc2a`。
- 独立配置：`/opt/outsider-01/config/Caddyfile`；固定基础镜像及派生步骤见 `deploy/Dockerfile.static`。运行镜像标签 `outsider01-static:caddy-base-844f60b6`，镜像 ID `sha256:1c250c273c96c424eedfbd06de1aac341a62f7b818f0415b389e26b81cf0e1c3`。
- 备份目录：`/opt/outsider-01/backups/20261004T062717Z-e9ccc2a/`（0700），保存原共享配置、发布候选配置和本站缓存修复前配置。
- 四文件构建包共 27,247 字节。`manifest.json` 记录 HTML/CSS/JS 的 SHA-256，已逐项核对本地、远端与公网响应一致；清单留在发布目录内，对外返回 404。
- 初次公网验收发现全局 `no-cache` 覆盖了哈希资源缓存；改为互不重叠的文档/资源匹配器，验证配置后只重启本站静态容器，最终响应已符合预期。共享 Caddy 仅在新增子路径时平滑重载，既有应用与共享代理容器 ID 和启动时间保持原值。
- 最新共享配置 SHA-256：`1c9ef48cb833b2a00af6d2a3c220ce566165fa5c0513927c7c0bfa757f86fde1`；本站配置 SHA-256：`ebcffe31d2b690ee9892e7d340140736a28201e8ad728ecf854ebb91ede02145`。
- 公网 11 项 HTTP 检查通过，包括系统信任 TLS 校验、文件哈希/缓存、目录 308、私有/不存在路径 404、POST 405，以及两个原应用的健康接口。两个原首页上线前后逐字相同。本机默认网络另行访问也返回 200。
- 真实 Chrome 的 1440×900 / 375×812 × 浅深色四组均通过，每组六项交互检查、四张截图。线上最终报告位于 `artifacts/quality/prototype-release-online-final/`，HTTP 报告位于 `artifacts/quality/prototype-release-online/http-audit.json`。浏览器通过临时 SSH SOCKS 访问真实 HTTPS，保留正常证书校验；HTTP 校验使用物理网卡直连。

复验命令（先保留与线上版本一致的本地发布清单）：

```bash
QA_INTERFACE=en0 node scripts/prototype-http-audit.mjs
QA_URL=https://8.209.239.47/outsider-01/ QA_ROUND=prototype-release-online-repeat node scripts/prototype-release-audit.mjs
```

需要代理时为浏览器检查另设 `QA_PROXY=socks5://127.0.0.1:10891`，并先自行建立对应临时隧道。网卡名称按当前电脑实际配置填写。浏览器手机尺寸属于视口模拟；此次未做实体手机、Safari 或二维原型的 Lighthouse 验收，完整三维站 M5 状态保持原记录。

### 动画优先布局更新（2026-10-04）

- 最新发布编号：`20261004T070841Z-3a082a0`；页面构建提交：`3a082a076354e31e19118394c8a4f82bd185dce6`。原地址保持，动画放在静态图片上方，桌面图例放在动画右侧；手机上下排列为动画、图例、图片。
- `/opt/outsider-01/current` 已原子切换到 `releases/20261004T070841Z-3a082a0`。旧发布目录完整保留；新目录额外保留上版哈希命名的 CSS/JS，使更新期间打开旧页面的访客仍能加载资源。新上传包仍为四个文件，共 27,606 字节，逐项核对上传前后及公网 SHA-256 一致。
- 共享路由、本站容器配置均无需改动；共享 Caddy 与本站容器 ID、启动时间保持不变，更新过程无需重启服务。
- 新版 11 项 HTTP 检查、桌面/手机 × 浅深色四组浏览器检查全通过，共 20 张截图，每组六项检查。本轮线上浏览器直接访问成功，保持正常 TLS 校验。证据保存在 `artifacts/quality/prototype-animation-first-online/`；已刷新用户当前打开的线上页，页面呈现新顺序。
- 如需回退此布局更新，只需将 `current` 原子切回 `releases/20261004T062717Z-e9ccc2a`，保留当前发布目录。此次未执行回退演练。
