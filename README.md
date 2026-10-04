# Sukimi

为 Suwayomi Server 打造的漫画网页客户端，采用液态玻璃设计，适配桌面与手机。

## 功能

- 首页继续阅读、最近更新与最近阅读。
- 书库筛选、排序、分类与批量操作。
- 单页、双页、纵向连续及 Webtoon 阅读，支持触屏翻页与缩放。
- 来源浏览与筛选、扩展管理、换源迁移。
- 阅读历史、下载队列与第三方追踪。
- 深浅色主题、毛玻璃、液态折射与不透明外观。

部分功能仍待真实服务端或设备验收，进度见 [PLAN.md](PLAN.md)。

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

开发模式提供仅使用虚构数据、无需登录的页面，例如 `/dev/source-filters`、`/dev/extensions`、`/dev/reader-gestures` 和 `/dev/settings-layout`。完整列表见 [CLAUDE.md](CLAUDE.md)，正式构建不包含这些页面。

云端开发可以运行类型检查、测试、构建和虚构数据页面。云端的 `localhost` 不指向你的电脑，连接本地 Suwayomi 服务端需要另行配置网络访问。

## 部署

正式构建输出到 `dist/`。推荐由 Suwayomi Server 以 `CUSTOM` WebUI 托管，保持前端与 `/api` 同源。

`pnpm deploy:server` 会构建并复制文件到 `.env.local` 中 `SUWAYOMI_DATA` 指定的数据目录下的 `webUI/`。部署前须确认服务端配置、备份与操作授权，部署后重启服务端才生效。具体流程见 [CLAUDE.md](CLAUDE.md)。

## 开发约定

开始贡献前请阅读 [AGENTS.md](AGENTS.md)、[CLAUDE.md](CLAUDE.md) 和 [PLAN.md](PLAN.md)。

项目旧名为 Suwayomi Web。为兼容已有登录状态、设置、缓存和历史记录，内部仍保留 `suwayomi-web` 存储名称与部署标记。

## 许可

项目自身代码尚未选择许可证。第三方代码的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
