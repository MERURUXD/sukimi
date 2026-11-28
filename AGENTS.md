# Agent 工作指南

本文件适用于在 Sukimi 仓库中进行开发、修复、重构、测试、文档维护和代码审查的 AI Agent，不限定工具或运行环境。以当前代码和配置为事实来源；使用方法与部署说明见 `README.md`，安全问题报告方式见 `SECURITY.md`。

## 项目概览

Sukimi 是配合 Suwayomi Server 使用的漫画 Web 客户端，面向桌面与移动设备。

- 技术栈：Vite、React、TypeScript、Apollo Client、Tailwind CSS v4。
- 环境：Node.js 24+、pnpm 11.22.0（以 `package.json` 为准）。
- `src/app/`：应用路由、布局和导航。
- `src/features/`：按功能划分的业务实现（书库、阅读器、来源、下载、追踪等）。
- `src/api/`：GraphQL、认证、客户端缓存、持久化和实时通信。
- `src/components/`、`src/design/`：共享组件与视觉基础设施。
- `src/i18n/`：简体中文和英文翻译。
- `src/lib/`：跨功能工具与运行环境判断。
- `scripts/`：测试、代码生成辅助和维护脚本；`deploy/`：部署示例。

开始修改前，先定位实际调用链、相关测试和既有约定；不要仅凭文件名或旧文档推断行为。

## 开发约定

- 回复与任务交付说明使用用户指定的语言；未指定时遵循当前对话语言，不强制使用简体中文。代码注释遵循相邻代码的语言和既有风格，标识符沿用项目已有命名。提交与 PR 的格式见下文“提交与 PR”。
- 用户可见文案通过现有 i18next 机制维护，修改时兼顾 `src/i18n/zh-CN/` 与 `src/i18n/en/`，不要把新文案直接写死为一种语言。
- 优先复用已有模块、组件、状态和设计令牌。修改保持聚焦，不为了顺手“清理”而扩大范围；重构时保留可观察行为。
- UI 延续项目的中性配色、玻璃质感与以留白组织内容的设计语言。兼顾触屏、键盘、窄屏以及 `prefers-reduced-motion`，不要引入无必要的装饰性卡片或分隔线。
- 对有实际行为契约的改动补充或调整测试。优先扩展所属功能的现有测试；只有存在独立边界或隔离需求时才拆分新文件。断言尽量围绕行为，而不是易变的文案、样式类名或内部实现。
- 测试用例应隔离缓存、客户端与可变数据，清理订阅、定时器和全局替身。不要为了让测试通过而削弱原有有效断言。

## 数据、安全与环境边界

- 不要索取、复制、提交或输出真实登录密码、令牌、Cookie、`server.conf` 凭据、个人路径或书库数据。开发和测试优先使用虚构数据；`.env.local` 等本地配置不应进入仓库。
- `/demo/` 使用虚构数据且免登录；`/dev/*` 的专项验收页只在本地开发和 Preview 构建中注册，使用模拟数据，不应访问真实 `/api`、真实书库快照或进行真实写入。涉及路由条件时，与 `src/lib/demo.ts` 的 `isDevLab` 保持一致。
- 注意例外：`/devtools` 是可连接真实服务端的开发者工具箱，仅在本地开发与 Preview 构建注册；`/dev/glass` 是仅本地开发开放的登录后调参页，不属于虚构验收页。不要把这些入口误当成普通模拟环境。
- 开发者工具箱的真实写入应有明确预演、操作上限及中止能力。批量已读/未读等大范围修改必须受 `__TEST_INSTANCE__`（`SUKIMI_TEST_INSTANCE=1`）保护，不得默认暴露给日用实例。
- 请求监视相关实现（`src/api/monitor.ts`）不得记录变量值、请求头、响应正文或持有请求/错误对象本身；开发专用工具和监视逻辑不得意外进入正式构建。
- 认证、切换账号、Apollo 缓存、IndexedDB 快照和阅读进度是重点数据边界。保持用户数据隔离，不要让模拟数据或其他账号的缓存进入当前账号。
- 修改 `src/api/persist.ts` 的 `ENTRIES` 对应查询字段时，递增该文件的 `VERSION`，使旧快照失效。
- 修改 `graphql(...)` 文档后运行 `pnpm codegen` 并提交必要的 `src/api/gql/` 生成结果；不要手动编辑生成文件。只有确需同步服务端 schema 时才运行 `pnpm schema`。
- 区分普通正式构建与 `SUKIMI_CHANNEL=preview` 的 Preview 构建。即使使用 Preview，连接相同的 Suwayomi Server 仍会共享真实后端数据；做破坏性验证应使用隔离实例。

## 常用命令

```sh
pnpm install --frozen-lockfile
pnpm dev              # 本地开发
pnpm typecheck        # TypeScript 检查
pnpm test             # scripts/*.test.mjs
pnpm lint             # oxlint
pnpm build            # 类型检查与正式打包
pnpm codegen          # GraphQL 文档生成
```

根据改动范围选择验证：优先运行相关测试，代码改动尽可能运行 `pnpm typecheck`；涉及公共逻辑、构建渠道、依赖或发版时，再运行完整测试、lint 与 build。不要把既有 warning 直接归因于当前修改，也不要隐瞒新引入的错误。环境无法执行某项检查时，说明原因，不要声称已通过。

## 工作流程

- 开工前先读本文件，运行 `git status --short` 看清工作区，只改任务需要的文件。
- `AGENTS.override.md`、`CLAUDE.md`、`PLAN.md`、`UPLOAD_CHECK.md`、`.claude/`、`.agents/`、`.codex/` 是各人的本地配置与过程记录，已在 `.gitignore` 中，不得强制加入 Git，也不要在仓库文件里引用其中的内容。
- `pnpm deploy:server`、`pnpm restart:server` 读取 `.env.local`，直接操作本机的 Suwayomi Server，属于维护者的本地运维命令；完成开发任务不需要运行它们，也不要为它们补写真实路径或地址。
- 拉取请求上的 CI 有两个必需检查：`ci-release`（`pnpm codegen` 后 `src/api/gql/` 不得有变化，再跑 `typecheck`、`test`、`build`）和 `ci-preview`（同样检查，以 `SUKIMI_CHANNEL=preview` 构建）。本地按改动范围先跑对应命令，不要依赖 CI 才发现问题。
- `.gitattributes` 强制 LF，新文件不要带 CR。

## 提交与 PR

- **提交信息**：Conventional Commits，`type(scope)` 用英文，描述用简体中文，例如 `fix(reader): 书签出错不再让顶栏一直不收起`；正文用中文说明为什么改、改了什么。一个提交只做一件事。scope 沿用已有的功能名（如 `reader`、`library`、`nav`、`ui`、`glass`、`api`）。
- **通过 PR 合入**：所有改动都从分支开 PR 合入 `main`，不直接推送到 `main`。`main` 受规则集保护：只允许 squash merge，必须通过 `ci-release` 与 `ci-preview`，审查讨论需全部解决。一个 PR 只做一件事。
- **高风险改动**：认证与切换账号、Apollo 缓存与 IndexedDB 快照（含 `persist.ts` 的 `VERSION`）、阅读进度同步、开发者工具箱的真实写入、构建渠道与 CI、依赖大版本升级。这类 PR 要补足测试，并在 Merge Danger 里写清楚影响；拿不准时按高风险处理。
- **PR 标题**：Conventional Commits 前缀加中文概述，例如 `perf(history): 历史页改用虚拟列表，翻到上千条也只挂视口附近的行`。Dependabot 自动生成的 PR 保留其原标题。
- **PR 正文**（中文，三节）：
  - `## Summary`：先用一个 `diff` 代码块列出改了哪些文件、各改了什么，再用一两段话说明改动和原因。
  - `## Evidence`：验证结果（命令、测试数量、CI 运行、实测数据）；没验证的单独写 `**未验证：**`。
  - `## Merge Danger`：`**Door:**` 写 `two-way`（可轻易回退）或 `one-way`（缓存格式、数据写入等一旦放出难以收回）；`**Blast Radius:**` 写合并后影响到谁、影响什么。
- **只写仓库里的事**：PR 标题、正文和提交信息要让任何读仓库的人都看得懂：写改了什么、为什么改、怎么验证的，原因用代码和仓库里的事实说明。不要提仓库外的讨论、评审或审计文档及其条目编号、聊天记录、任务或某人的请求，也不要列其他项目的内部文件。
- **合并**：由维护者 squash merge，合并提交标题与 PR 标题一致，所以 PR 标题要能直接当提交标题用。
- **代码审查意见**（人工或自动审查）：逐条核实，按根因归并，修掉成立的，在对应讨论里说明不采纳的理由。

## 发布

发布由维护者进行，普通 PR 不涉及：

- 合并到 `main` 会触发 `webui-release`，重新打包并更新滚动的 `webui-latest` 预发布版本，日用服务器会定时拉取它。因此合并本身就是一次发布，只由维护者决定。
- 推送到 `preview` 分支（或手动触发）会触发 `webui-preview`，更新 `webui-preview` 预发布版本；Preview 与日用版共用同一个 Suwayomi Server 时写入的是真实数据。
- 普通 PR 不推送 `preview` 分支，不移动 `webui-latest`、`webui-preview` 标签，不改 `package.json` 的版本号。改动 `.github/rulesets/` 或发布工作流的 PR 按高风险处理。

## 审查与交付

- 无论执行开发还是审查，都优先关注可实际触发的功能回归、数据损坏、跨账号数据混用、隐私泄露、构建失败及上述环境边界被破坏的问题。
- 审查意见应指出具体文件、触发条件和用户可见后果，按影响程度排序。区分已证实的问题、合理风险和单纯的风格建议；不要把假设性的极端情况当成必现缺陷。
- 完成任务时简要交代修改内容、实际执行的检查及结果、未验证之处和需要人工决定的事项。不要因为任务由某种 Agent 执行就改变质量标准或假定拥有真实服务器访问权限。
