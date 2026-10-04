# AGENTS.md

本项目的全部约定写在 [CLAUDE.md](CLAUDE.md)：环境、命令、架构、设计规范、踩过的坑。**开始任何工作前先完整阅读它和 [PLAN.md](PLAN.md)。**

其中最重要的三条，这里重复一遍：

1. **不要查看书库内容**（有成人内容）。检查界面用 DOM / JS，或者开发安全模式 `localStorage['suwayomi-web.dev.safe'] = '1'`。只有「再漫画」来源的内容（`data-sfw`）可以看。
2. **永远不要询问、保存或输入 Suwayomi 的登录密码。** `server.conf` 里有账号密码，只 grep 需要的那一行。
3. **改服务端配置、重启服务端、部署（`pnpm deploy:server`）之前先征得用户同意**，改之前先备份。

界面文字、注释、提交信息用简体中文；改完运行 `pnpm typecheck` 和 `pnpm test`；新增或修改 GraphQL 文档后运行 `pnpm codegen`。
