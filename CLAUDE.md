# Sukimi

为自建的 Suwayomi 漫画服务端写的新网页前端：Apple / Panels 风格的「液态玻璃」界面。主要在 Windows 版 Chrome 上使用，也要适配手机。

- 项目名为 **Sukimi**，包名及 GitHub 仓库名用 `sukimi`。已有的 `suwayomi-web.*` 存储键、IndexedDB 名称和部署标记保留，以兼容已保存的数据；本地目录暂保留原路径。

- 路线图和进度：[PLAN.md](PLAN.md)。第 6 节是第二阶段计划，A 至 E 已完成（D、E 的真实服务端验收待完成），接下来是 **F：打磨**（平板布局、阅读设置跨设备、浅色主题走查、测试、真机）。每项做完把勾打上，并写一行「实现」说明。
- 界面文字、代码注释、提交信息一律用**简体中文**。注释解释「为什么」，跟周围代码的密度保持一致。
- 和用户交流用中文，少用术语。

## 必须遵守（安全与隐私）

1. **不要查看书库内容。** 书库里有成人内容，不要截图或读出书库、首页、更新页、详情页、阅读器里的封面和标题。
   - 检查界面时用 DOM / JS 判断（元素数量、位置、计算样式），或者打开开发安全模式：在浏览器里执行 `localStorage['suwayomi-web.dev.safe'] = '1'` 后刷新。这样图片会被隐藏、文字打码。
   - 例外：来源是「再漫画」的漫画可以正常看。开发模式下这类元素带 `data-sfw` 属性（见 `src/lib/devSafe.ts`）。设置页整页标了 `data-sfw`，可以截图。
2. **永远不要询问、保存或输入 Suwayomi 的登录密码。** 密码只由用户自己在登录页输入，不写进任何配置文件或代码。
   - 需要调用接口时，复用浏览器里已登录的会话（同源请求会自动带上 `suwayomi-server-token` Cookie）。
   - `server.conf` 里有账号密码：只用 grep 读需要的那一行，不要整份读出来。
3. **改服务端配置、重启服务端、部署前先征得用户同意。** 这些操作会影响用户正在使用的服务。改之前先备份。

## 环境

- 服务端：当前适配 Suwayomi Server v2.4.2366，数据目录含 `server.conf`、`webUI/` 和数据库。安装目录、监听地址及启动方式由使用者自行配置。
  - 登录方式是 `UI_LOGIN`（JWT）。本前端只支持这种方式。
- 部署方式：`server.webUIFlavor = CUSTOM`，服务端直接托管数据目录下的 `webUI/`，也就是本项目的打包结果。
  - 部署前备份 `server.conf` 与原有 `webUI/`，重启方法按实际安装方式选择。
  - 回退：把 `webUIFlavor` 改回 `WEBUI` 再重启，服务端会重新下载官方界面。
- `.env.local`（不进 git）：
  - `SUWAYOMI_URL=http://localhost:4567`：开发代理和拉 schema 用。
  - `SUWAYOMI_DATA`：部署用，指向使用者自己的 Suwayomi 数据目录。

## 常用命令（pnpm）

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器 5173，`/api` 代理到服务端（包括 WebSocket） |
| `pnpm typecheck` | `tsc -b`，每次改完都要跑 |
| `pnpm test` | Node 24 内置测试器跑 `scripts/*.test.mjs`；全部用虚构数据，不读真实书库（`pnpm test:source-filters` 只跑来源筛选） |
| `pnpm lint` | oxlint；已有的几类 warning 可以忽略 |
| `pnpm build` | 正式打包到 `dist/` |
| `pnpm codegen` | 新增或修改 `graphql(...)` 文档后**必须**运行，生成 `src/api/gql/` |
| `pnpm schema` | 服务端升级后重新拉 `src/api/schema.graphql`，再跑 codegen |
| `pnpm deploy:server` | 打包并复制到 `data/webUI`（要求 `webUIFlavor` 为 CUSTOM），之后**要重启服务端**才生效：服务端在启动时把 webUI 复制到临时目录再托管 |

完整测试框架还没有搭（计划在第二阶段 F）。来源筛选已有 Node 内置测试。每个功能做完都要自行用浏览器确认视觉与交互，至少检查桌面和手机宽度；遵守安全模式和内容隐私要求，区分虚构数据验收与真实来源验收。`/dev/source-filters`、`/dev/extensions`、`/dev/migrate`、`/dev/history`、`/dev/downloads`、`/dev/tracking`、`/dev/reader-gestures`、`/dev/settings-layout` 是无需登录、不连接真实服务端的验收页，用虚构数据复用正式组件和缓存规则，正式构建不包含它们。内置浏览器的登录过期时，先用这些页面检查界面。

## 技术栈

- Vite 8（rolldown）、React 19、TypeScript 6（不要用 `baseUrl`，路径别名是 `@/*` → `src/*`）。
- Tailwind v4：令牌写在 `src/index.css` 的 `@theme inline` 里，深浅色由 `html[data-theme]` 切换。
- 其他依赖：
  - Apollo Client 4（hooks 从 `@apollo/client/react` 导入）、graphql 17、graphql-ws。
  - GraphQL Codegen client preset（`enumsAsTypes`，关闭 fragment masking）。
  - react-router 8（数据路由，`RouterProvider` 从 `react-router/dom` 导入）。
  - zustand（persist）、motion（`motion/react`）、@tanstack/react-virtual、@use-gesture/react、lucide-react。

## 目录

```
src/
  api/        auth（令牌）、client（Apollo）、live（订阅）、persist（本地快照）、upload（文件上传）、chapters、schema.graphql、gql/（生成，勿手改）
  app/        router、AppShell（AuthGate、布局）、TopNav、MobileTabBar、ScrollManager
  components/ glass/（Glass、折射）、ui/（Popover、Seg、BatchBar、toast、Confirm）、manga/
  design/     外观设置、玻璃调参、动效参数
  features/   home、library、manga（详情）、reader、updates、browse、settings（含 tabs/）、auth、dev
  lib/        coverTransition、intro（进场动画）、format、devSafe、useSelection、useLongPress
scripts/      fetch-schema.mjs、deploy.mjs
public/sw.js  会自我注销的 Service Worker，用来清掉官方 WebUI 留下的离线缓存，不要删
```

## 设计约定

- 视觉方向：玻璃质感，只用白色作强调色。首页是重点，要做得最漂亮。
- **不要做框住的卡片、分隔线，章节列表里也不要白圈复选框。** 分组只靠留白。
- 玻璃组件用 `Glass`（`as` 可以指定标签，`dense` 表示更不透明）。要做动画时用 `MotionGlass`。按钮的玻璃和按钮本身是**同一个元素**（`<Glass as="button">`），不要再包一层，否则 hover 遮罩和边框对不齐。
- 动效参数在 `src/design/motion.ts`。列表首次加载的进场动画用 `.rise` 类加 `--d` 延迟（见 `lib/intro.ts`）；从缓存秒开时不播。
- 要照顾 `prefers-reduced-motion`（全局已处理）。
- 手机断点：`< 768px` 用底部标签栏，`md` 及以上用顶部导航。

## 关键实现与踩过的坑

- **登录令牌**（`api/auth.ts`）
  - access token 只有 5 分钟，存在内存，同时写进 `suwayomi-server-token` Cookie，这样 `<img>` 和直链也能通过鉴权。
  - refresh token 有效 60 天，存在 localStorage。续期请求是单飞的（并发调用共用同一次请求），到期前 60 秒自动续期。
  - 遇到 Unauthorized 时，先续期再重试一次（`ErrorLink`）。
- **WebSocket 订阅**：服务端只在 `connection_init` 时鉴权，读 `payload.Authorization`，要的是**不带 `Bearer ` 的裸令牌**。Jetty 空闲 30 秒会断开连接，所以要设 `keepAlive: 15000`。下载、书库更新状态由 `api/live.ts` 全局订阅，再改写缓存。下载相关变更（排序、移出、清空）都返回完整队列，用 `setDownloadStatus` 直接写回，不等推送。
- **扩展**：`ExtensionType` 没有 id，在 `api/cache.ts` 里以 `pkgName` 规范化。装卸扩展后要清掉缓存里的 `sources` 和可更新数量（`forgetSources`），否则发现页的来源列表不会变。
- **追踪登录**：OAuth 回调地址固定为 `/tracker/login/oauth`（和官方网页界面一致，suwayomi.org 的中转页按 `state.redirectUrl` 跳回）。追踪网站的账号密码只由用户自己填，不要代填。
- **阅读历史的删除**：服务端不能删阅读记录，用章节元数据 `suwayomi-web.historyHiddenAt` 隐藏（`features/history/history.ts` 的 `isVisible`）。新增展示阅读记录的地方也要用它过滤。
- **GraphQL 联合类型缓存**（`api/cache.ts`）：使用 `Filter` 片段时必须登记 `possibleTypes`；否则 Apollo 读缓存后可能只剩 `__typename`，来源筛选会缺失选项并报错。开发验收页复用这套配置。
- **时间单位不统一**：`uploadDate` 和 `lastUpdateTimestamp` 是毫秒，`fetchedAt`、`lastReadAt`、`inLibraryAt` 是秒。用 `lib/format.ts` 里的 `ms()` 和 `sec()` 转换。
- **阅读进度**：服务端会把 `lastPageRead` 截到 `pageCount - 1`。`pageCount` 未知（-1）时会存成 0，所以要先调用 `fetchChapterPages`。
- **液态玻璃**：任何带 filter、opacity < 1、mask、clip-path、backdrop-filter 或 `view-transition-name` 的祖先元素，都会成为 backdrop root，里面的玻璃就会失效。
  - 所以透明度动画要做在玻璃元素自己身上（`MotionGlass`，或者 `.rise-each` 给每个子元素单独加）。
  - 也**不要**给顶栏这类装着玻璃的容器设常驻的 `view-transition-name`。
- **导航选中块**（`components/ui/NavPill.tsx`、`useNavPill.ts`）：顶栏、底栏是 fixed，不要用 motion 的 `layoutId` 做选中块。它按页面坐标测量，页面滑动过再切换时会错位。现在按容器内的 offsetLeft 移动一个常驻元素。
- **封面飞入 / 飞回**（`lib/coverTransition.ts`）：
  - 同一时刻页面上只能有一个元素叫 `manga-cover`。名字重复时 Chrome 会直接放弃整个过渡（InvalidStateError）。
  - 进入：点击时只给被点的那个封面挂上过渡名。
  - 返回：包了一层 `document.startViewTransition`，在新页面渲染完、截图前找回原来那个封面。靠 `main[data-page-path]` 判断是从哪页回到哪页。React Router 在后退时会自动重放过渡。
  - 虚拟列表第一帧就要按恢复后的滚动位置渲染（`useRestoredOffset`），否则那个格子还不在 DOM 里。
  - 发现页的结果留在内存里，返回时直接恢复，原理相同。
- **书库很大**（3000 多部，数据 1.7MB，请求约 2.5 秒）：
  - 书库、首页、更新页的查询结果存进 IndexedDB（`api/persist.ts`）。刷新后先用快照渲染，网络数据到了再替换。
  - 快照**不写回** Apollo 缓存：几千部写进规范化缓存再读出来要一秒多。
  - 改了快照里查询的字段，要把 `VERSION` 加一。
- **服务端设置**（`features/settings/server.ts`）：
  - `SettingsType` 是没有 id 的单例，已经在 cache 的 typePolicies 里设了 `keyFields: []`。
  - 密码和 API Key 不查询，只能填新值（`SSecret`）。需要重启才生效的项登记在 `RESTART_KEYS`。危险项改动前要通过 `confirmChange` 弹确认。
  - Duration 是 ISO 8601 格式（如 `PT5M`）。
- **设置布局**：`Row stack` 的标签不能保留横向的 `flex-basis: 240px`，否则变成高度，产生大块空白。设置侧栏的选中块按玻璃容器内的 `offsetTop` 滑动，避免 sticky 和页面滚动影响共享布局动画。`no-scrollbar` 只隐藏轨道，不能用 `overflow-hidden` 替代面板滚动。
- **文件上传**：Apollo 不支持上传，用 `api/upload.ts` 按 multipart 规范单独发请求（恢复备份时用到）。
- **阅读器手势**（`reader/PagedView.tsx`、`gestures.ts`）：翻页视图是一条轨道，摆着「上一页 | 当前页 | 下一页」，以页码作 key；翻页滑到位后相邻页就地变成当前页，不要改成先滑出再换内容（会停顿、闪动）。滑动位移加在轨道上、外层裁切，不要加在可滚动容器内部（RTL 下会被「滚到最右」带偏，还会冒出滚动条）。内容用 `translate scale` 变换、原点在中心，缩放以手指 / 指针为中心（`zoomAround`），平移按 `panBounds` 限制。用脚本模拟双指缩放时，手势库会对假指针调用 `setPointerCapture` 而报错，测试前把它换成空函数。
- **内置浏览器预览的局限**：
  - 大约 1 帧每秒、窗口经常处于 hidden，动画和 view transition 在里面测不准，测到会被跳过。
  - `blur()` 不会触发 React 的 `onBlur`，要手动派发 `focusout` 事件。
  - 需要看动画时，请用户在真实的 Chrome 里确认。

## 测试过程中改过的用户数据

验证功能时尽量用可以还原的操作，做完马上改回原样，并告诉用户改了什么。不要动阅读进度、书签、分类这类数据，除非用户同意。
