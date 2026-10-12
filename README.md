# Sukimi

为 Suwayomi Server 打造的漫画网页客户端，采用液态玻璃设计，适配桌面与手机。

## 功能

- 首页继续阅读、最近更新与最近阅读。
- 书库筛选、排序、分类与批量操作。
- 单页、双页、纵向连续及 Webtoon 阅读，支持触屏翻页与缩放。
- 来源浏览与筛选、扩展管理、换源迁移。
- 阅读历史、下载队列与第三方追踪。
- 多用户：注册码注册、找回与修改密码、管理员「用户」页，书库偏好与缓存按账号分开，功能入口按权限显示（见下文）。
- 深浅色主题、毛玻璃、液态折射与不透明外观。

扩展安装、换源迁移、第三方追踪授权与同步等功能仍待真实服务端验收；触屏手势与动画观感仍需真实设备确认。

## 多用户

服务端的用户账号功能（Suwayomi-Server PR #623）目前只在预览版里（v2.4.2379 起），稳定版 v2.4.2366 不含；预览版升级会做不可逆的数据库迁移，升级前先备份，待稳定版发布后这里再更新。

- **兼容旧服务端**：查不到当前用户时按单用户管理员使用，隐藏注册、改密码与「用户」页；本地偏好沿用原存储键。
- **注册与找回**：管理员在「设置 → 用户」生成注册码，对方在登录页点「用注册码注册」（或打开 `/register?code=…`）自选用户名和密码；忘记密码由管理员生成找回码，对方在 `/recover` 设置新密码。码只显示一次。
- **本地数据**：书库视图、阅读器设置等偏好与书库快照按账号分开；外观设置整台设备共用。升级后第一个登录的账号会继承原有偏好，其他账号从默认值开始。
- **权限**：扩展安装 / 卸载、下载、服务端设置等入口按账号权限显示；权限变更最长 5 分钟后生效。OPDS、同步、自动下载等设置归各账号自己，来源偏好与下载队列控制仍为所有用户共用。

## 本地开发

需要 Node.js 24、pnpm 11.22.0 和启用 `UI_LOGIN` 登录方式的 Suwayomi Server。当前项目使用的服务端版本为 v2.4.2366。

1. 运行 `pnpm install --frozen-lockfile` 安装依赖。
2. 复制 `.env.example` 为 `.env.local`，将 `SUWAYOMI_URL` 设置为服务端地址。
3. 运行 `pnpm dev`，打开终端显示的开发地址。
4. 在登录页自行输入 Suwayomi 服务端账号和密码。

`.env.local` 不提交到 Git；不要将账号、密码、令牌或真实书库数据放进仓库。

## 检查与构建

```sh
pnpm typecheck
pnpm test
pnpm build
```

新增或修改 GraphQL 文档后运行 `pnpm codegen`。`pnpm schema` 用于从配置的服务端重新获取 schema。

## 无服务端验收

登录页点击「无需登录，体验演示」，或直接访问 `/demo/`。演示包含首页、书库、详情、阅读器、更新、发现和阅读历史；使用 12 部虚构作品、原创几何封面与本地生成的阅读页，开发及正式构建均可访问，无需启动 Suwayomi Server。

演示使用独立的内存数据和外观 / 阅读 / 书库设置，不读取登录会话与书库快照，也不连接真实服务端。搜索、分类、已读状态、书签与阅读进度可在演示中体验，刷新后书库和进度恢复初始状态。演示的「设置 → 账户」可切换虚构的管理员与普通用户，查看「用户」页和按权限显示的入口，改账号的操作一律拒绝。下载、扩展安装、换源迁移、追踪、备份和服务端配置需要退出演示并登录后使用。静态托管需将 `/demo/*` 等页面路由回退到 `index.html`。

开发模式提供仅使用虚构数据、无需登录的专项验收页面：`/dev/source-filters`、`/dev/extensions`、`/dev/migrate`、`/dev/history`、`/dev/downloads`、`/dev/tracking`、`/dev/reader-gestures` 和 `/dev/settings-layout/:tab?`。正式构建不包含这些页面。

云端开发可以运行类型检查、测试、构建和虚构数据页面。云端的 `localhost` 不指向你的电脑，连接本地 Suwayomi 服务端需要另行配置网络访问。

## 部署

正式构建输出到 `dist/`。推荐由 Suwayomi Server 以 `CUSTOM` WebUI 托管，保持前端与 `/api` 同源。

`pnpm deploy:server` 会构建并复制文件到 `.env.local` 中 `SUWAYOMI_DATA` 指定的数据目录下的 `webUI/`。部署前备份数据目录中的 `server.conf` 和现有 `webUI/`，确认 `server.webUIFlavor = CUSTOM` 并获得服务端操作授权；部署后重启服务端才生效。

Windows 本地 Java 安装可先运行 `pnpm restart:server -WhatIf` 预检，再运行 `pnpm restart:server` 重启。脚本核验进程身份、备份配置与前端，并检查启动后的 HTTP 响应；不自动提升权限，备份不包含运行中的数据库。Windows 服务及其他安装方式应使用相应的服务管理工具。

### Preview 环境（可选）

需要用真实书库验收开发中的改动、又不想替换日用版时，可以在另一个子域名长期部署一套 Preview 前端，与日用版共用同一个 Suwayomi：

- **共用后端就是共用数据，不是沙箱。** 两个前端读写的是同一份服务端数据：阅读进度、书签、分类、下载、来源、扩展、追踪和服务端设置的改动会互相影响，换个账号也不能隔离。Preview 里的确认框会额外提示这一点。删除、换源、扩展安装卸载、恢复备份等破坏性测试应使用独立的 Suwayomi 测试实例和数据副本。
- **浏览器本地状态互不影响。** 两个子域名是不同的源：登录 Cookie（不带 Domain）、续期令牌、偏好设置和本地书库快照各存各的，在 Preview 里退出登录或清缓存不影响日用版。
- **构建**：设置 `SUKIMI_CHANNEL=preview` 后运行 `pnpm build`，页面会常驻「Preview · 提交号」标识，标题加 `[Preview]` 前缀，并禁止搜索引擎收录。仓库的 `webui-preview` 工作流在推送 `preview` 分支或手动指定分支时自动打包，发布到 `webui-preview` 预发布版本；日用版继续由 `main` 发布到 `webui-latest`，两边互不覆盖。
- **托管**：由反向代理直接托管静态文件，`/api/*`（含 WebSocket）转发到同一个 Suwayomi，前端路由回退到 `index.html`。示例见 [deploy/preview/Caddyfile.example](deploy/preview/Caddyfile.example)。前端调接口自带 Bearer 令牌，所以代理层的访问密码只能保护页面和静态资源，`/api` 仍靠 Suwayomi 自己的登录保护。
- **更新与回滚**：[deploy/preview/update-preview.sh](deploy/preview/update-preview.sh) 拉取 `webui-preview`，校验哈希后切换到新版本目录，只写 Preview 目录，不调用会覆盖服务端 `webUI/` 的 `pnpm deploy:server`；`--rollback` 切回上一份，默认保留最近 5 份。可配合定时任务自动更新。

## 开发约定

界面文字、代码注释与提交信息使用简体中文。开发与验收使用虚构数据；不要提交环境配置、登录凭据或真实书库数据。改动后运行类型检查与测试，涉及界面、路由或资源时补跑构建；GraphQL 文档变更后重新生成类型。

项目旧名为 Suwayomi Web。为兼容已有登录状态、设置、缓存和历史记录，内部仍保留 `suwayomi-web` 存储名称与部署标记。

## 许可

项目自身代码尚未选择许可证。第三方代码的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
