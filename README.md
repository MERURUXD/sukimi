# Sukimi

为 Suwayomi Server 打造的漫画网页客户端，采用液态玻璃设计，适配桌面与手机。

## 功能

- 首页继续阅读、最近更新与最近阅读。
- 书库筛选、排序、分类与批量操作。
- 单页、双页、纵向连续及 Webtoon 阅读，支持触屏翻页与缩放。
- 来源浏览与筛选、扩展管理、换源迁移。
- 阅读历史、下载队列与第三方追踪。
- 深浅色主题、毛玻璃、液态折射与不透明外观。

扩展安装、换源迁移、第三方追踪授权与同步等功能仍待真实服务端验收；触屏手势与动画观感仍需真实设备确认。

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

演示使用独立的内存数据和外观 / 阅读 / 书库设置，不读取登录会话与书库快照，也不连接真实服务端。搜索、分类、已读状态、书签与阅读进度可在演示中体验，刷新后书库和进度恢复初始状态。下载、扩展安装、换源迁移、追踪、备份和服务端配置需要退出演示并登录后使用。静态托管需将 `/demo/*` 等页面路由回退到 `index.html`。

开发模式提供仅使用虚构数据、无需登录的专项验收页面：`/dev/source-filters`、`/dev/extensions`、`/dev/migrate`、`/dev/history`、`/dev/downloads`、`/dev/tracking`、`/dev/reader-gestures` 和 `/dev/settings-layout/:tab?`。正式构建不包含这些页面。

云端开发可以运行类型检查、测试、构建和虚构数据页面。云端的 `localhost` 不指向你的电脑，连接本地 Suwayomi 服务端需要另行配置网络访问。

## 部署

正式构建输出到 `dist/`。推荐由 Suwayomi Server 以 `CUSTOM` WebUI 托管，保持前端与 `/api` 同源。

`pnpm deploy:server` 会构建并复制文件到 `.env.local` 中 `SUWAYOMI_DATA` 指定的数据目录下的 `webUI/`。部署前备份数据目录中的 `server.conf` 和现有 `webUI/`，确认 `server.webUIFlavor = CUSTOM` 并获得服务端操作授权；部署后重启服务端才生效。

Windows 本地 Java 安装可先运行 `pnpm restart:server -WhatIf` 预检，再运行 `pnpm restart:server` 重启。脚本核验进程身份、备份配置与前端，并检查启动后的 HTTP 响应；不自动提升权限，备份不包含运行中的数据库。Windows 服务及其他安装方式应使用相应的服务管理工具。

## 开发约定

界面文字、代码注释与提交信息使用简体中文。开发与验收使用虚构数据；不要提交环境配置、登录凭据或真实书库数据。改动后运行类型检查与测试，涉及界面、路由或资源时补跑构建；GraphQL 文档变更后重新生成类型。

项目旧名为 Suwayomi Web。为兼容已有登录状态、设置、缓存和历史记录，内部仍保留 `suwayomi-web` 存储名称与部署标记。

## 许可

项目自身代码尚未选择许可证。第三方代码的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
