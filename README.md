# Sukimi

为 Suwayomi Server 打造的漫画网页客户端，采用液态玻璃设计，适配桌面与手机。

A liquid-glass web client for Suwayomi Server. The interface is available in Simplified Chinese and English. English documentation: [README.en.md](README.en.md).

**语言**：界面支持简体中文和英文，可在登录页右上角或「设置 → 外观」切换。

![首页](docs/screenshots/home.png)

| 书库（浅色） | 漫画详情 |
| --- | --- |
| ![书库浅色主题](docs/screenshots/library-light.png) | ![漫画详情](docs/screenshots/detail.png) |

截图均来自内置的虚构演示数据（见[无服务端验收](#无服务端验收)）。

## 服务端要求

- **Suwayomi Server 稳定版 v2.4.2366**。多用户功能需要预览版 v2.4.2379 起（见[多用户](#多用户)）。
- 登录方式（`server.authMode`）设为 `UI_LOGIN`。不支持无登录、Basic Auth 等其他方式。
- 推荐由服务端以 `CUSTOM` 方式托管本前端，见[部署](#部署)。

## 功能

- 首页继续阅读、最近更新与最近阅读。
- 书库筛选、排序、分类与批量操作。
- 单页、双页、纵向连续及 Webtoon 阅读，支持触屏翻页与缩放。
- 阅读时屏幕常亮、自动裁白边、宽页拆成两半、图像滤镜（亮度 / 暖色 / 灰度 / 反色）、保存或分享当前页、页面书签；按漫画记住的阅读模式可按手机 / 平板 / 电脑分开。
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

需要 Node.js 24、pnpm 11.22.0 和满足[服务端要求](#服务端要求)的 Suwayomi Server。

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

开发模式提供仅使用虚构数据、无需登录的专项验收页面：`/dev/source-filters`、`/dev/extensions`、`/dev/migrate`、`/dev/history`、`/dev/downloads`、`/dev/tracking`、`/dev/reader-gestures`、`/dev/settings-layout/:tab?` 和 `/dev/devtools`。本地开发与 Preview 构建包含这些页面，正式构建不包含。

本地开发与 Preview 构建的演示还支持两个网址参数，进入演示时读一次：`/demo/library?scale=1000` 在演示书库上再生成指定数量的虚构作品（最多 10,000 部，超过 1,000 部时按比例减少每部话数），`&edge=1` 追加边界作品（超长标题、无封面、封面失效、5,000 话、零话、混排文字，以及无分类 / 多分类组合）。正式构建忽略这两个参数。

云端开发可以运行类型检查、测试、构建和虚构数据页面。云端的 `localhost` 不指向你的电脑，连接本地 Suwayomi 服务端需要另行配置网络访问。

## 部署

从 [webui-latest Release](https://github.com/MERURUXD/sukimi/releases/tag/webui-latest) 下载构建包：桌面端使用 `sukimi-webui.zip`，Linux 命令行使用 `sukimi-webui.tar`。

### 桌面端：使用 Suwayomi Launcher（推荐）

1. **停止 Suwayomi Server**。通过 Launcher 的 `Root Directory` 确认实际数据目录（包含 `server.conf`），备份其中的 `server.conf` 和原 `webUI/`。
2. 下载 `sukimi-webui.zip`，备份后清空旧 `webUI/`，将 **ZIP 内的文件** 直接解压到该目录。检查 `webUI/index.html` 直接存在，不要多套一层 `dist/` 或 `sukimi-webui/`。
3. 打开官方 [Suwayomi Launcher](https://github.com/Suwayomi/Suwayomi-Launcher) 的 `WebUI` 选项卡，启用 `WebUI` 并将 `WebUI Flavor` 设为 `Custom`；在 `Authentication` 选项卡选择 `UI_LOGIN`（原本就是此模式则不用改）。
4. 点击 `Launch` 启动 Suwayomi，访问原来的服务端地址即可。

**更新**：重新下载构建包、替换 `webUI/` 并重启服务端。

### Linux / VPS：无图形界面部署

原生 Java / systemd 安装：停止 Suwayomi，备份数据目录中的 `server.conf`，然后修改以下设置：

```hocon
server.webUIEnabled = true
server.webUIFlavor = "Custom"
server.authMode = "ui_login"
server.webUISubpath = ""
server.systemTrayEnabled = false
server.initialOpenInBrowserEnabled = false
```

从上述 Release 下载 `sukimi-webui.tar` 到服务器后，在 TAR 所在目录执行（把路径换成自己的数据目录，确保服务端已停止）：

```sh
DATA_DIR=/path/to/Tachidesk
# 先保留旧前端，方便回退
if [ -d "$DATA_DIR/webUI" ]; then
  mv "$DATA_DIR/webUI" "$DATA_DIR/webUI.bak.$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$DATA_DIR/webUI"
tar -xf sukimi-webui.tar -C "$DATA_DIR/webUI"
test -f "$DATA_DIR/webUI/index.html"
```

使用原来的方式启动 Suwayomi（systemd 安装则重启对应的服务单元）。

### Docker Compose（Linux / NAS）

在现有 [Suwayomi Docker Compose](https://github.com/Suwayomi/Suwayomi-Server-docker) 的 `suwayomi` 服务中设置（以下为配置片段）：

```yaml
services:
  suwayomi:
    environment:
      - WEB_UI_ENABLED=true
      - WEB_UI_FLAVOR=Custom
      - AUTH_MODE=ui_login
    volumes:
      - ./data:/home/suwayomi/.local/share/Tachidesk
```

上例的 `./data` 是**宿主机数据目录**（以 Compose 项目目录为基准）；如果已用其他宿主机路径或命名卷，沿用原映射，并在对应的数据卷内找到 `server.conf` 和 `webUI/`；命名卷应通过挂载该卷的维护容器操作，不能直接把下方宿主机路径示例照搬。首次部署应先启动一次 Suwayomi，让数据目录生成。

1. 执行 `docker compose stop suwayomi`，备份宿主机数据目录中的 `server.conf` 和原 `webUI/`。
2. 将 `sukimi-webui.tar` 解压到宿主机数据目录的 `webUI/`（同上 Linux 命令，把 `DATA_DIR` 换成宿主机映射路径）。
3. 执行 `docker compose up -d suwayomi`。

Docker 环境变量会在容器启动时覆盖对应的服务端配置；如果 `WEB_UI_FLAVOR` 仍为 `WebUI`，手动解压的文件可能被官方前端替换。

**回退**：停止服务端，用备份还原 `webUI/` 后重启，即可回到原先的文件版本；若要切换回官方 WebUI，在 Launcher 中选择 `WebUI`，或把 `server.webUIFlavor` 设为 `"WebUI"`（Docker 则修改 `WEB_UI_FLAVOR`）再重启。切回官方 WebUI 不保证恢复到先前完全相同的官方前端版本。

### 从源码部署

正式构建输出到 `dist/`。`pnpm deploy:server` 会构建并复制文件到 `.env.local` 中 `SUWAYOMI_DATA` 指定的数据目录下的 `webUI/`；第一次部署时，原有的官方 WebUI 会先整个备份到 `webUI-official-<时间>`。部署前备份 `server.conf`，确认 `server.webUIFlavor = "Custom"` 并获得服务端操作授权。脚本会顺带更新服务端运行中使用的临时副本，通常免重启生效；找不到这份副本时仍需重启。

Windows 本地 Java 安装可先运行 `pnpm restart:server -WhatIf` 预检，再运行 `pnpm restart:server` 重启。脚本核验进程身份、备份配置与前端，并检查启动后的 HTTP 响应；不自动提升权限，备份不包含运行中的数据库。Windows 服务及其他安装方式应使用相应的服务管理工具。

### Preview 环境（可选）

需要用真实书库验收开发中的改动、又不想替换日用版时，可以在另一个子域名长期部署一套 Preview 前端，与日用版共用同一个 Suwayomi：

- **共用后端就是共用数据，不是沙箱。** 两个前端读写的是同一份服务端数据：阅读进度、书签、分类、下载、来源、扩展、追踪和服务端设置的改动会互相影响，换个账号也不能隔离。Preview 里的确认框会额外提示这一点。删除、换源、扩展安装卸载、恢复备份等破坏性测试应使用独立的 Suwayomi 测试实例和数据副本。
- **浏览器本地状态互不影响。** 两个子域名是不同的源：登录 Cookie（不带 Domain）、续期令牌、偏好设置和本地书库快照各存各的，在 Preview 里退出登录或清缓存不影响日用版。
- **构建**：设置 `SUKIMI_CHANNEL=preview` 后运行 `pnpm build`，页面会常驻「Preview · 提交号」标识，标题加 `[Preview]` 前缀，并禁止搜索引擎收录。仓库的 `webui-preview` 工作流在推送 `preview` 分支或手动指定分支时自动打包，发布到 `webui-preview` 预发布版本；日用版继续由 `main` 发布到 `webui-latest`，两边互不覆盖。
- **托管**：由反向代理直接托管静态文件，`/api/*`（含 WebSocket）转发到同一个 Suwayomi，前端路由回退到 `index.html`。示例见 [deploy/preview/Caddyfile.example](deploy/preview/Caddyfile.example)。前端调接口自带 Bearer 令牌，所以代理层的访问密码只能保护页面和静态资源，`/api` 仍靠 Suwayomi 自己的登录保护。
- **更新与回滚**：[deploy/preview/update-preview.sh](deploy/preview/update-preview.sh) 拉取 `webui-preview`，校验哈希后切换到新版本目录，只写 Preview 目录，不调用会覆盖服务端 `webUI/` 的 `pnpm deploy:server`；`--rollback` 切回上一份，默认保留最近 5 份。可配合定时任务自动更新。

#### 开发者工具箱

Preview 构建（和本地开发）在「设置 → 关于」里多一个「开发者工具箱」入口，路径 `/devtools`，登录后可用。正式构建不注册这个路由，也不打包它的代码。工具箱和 Preview 其余页面一样连着日用的 Suwayomi，各工具的影响如下：

| 工具 | 影响范围 | 说明 |
| --- | --- | --- |
| 环境诊断 | 只读 | 显示前端提交、构建时间、服务端版本、实时连接与请求延迟；不显示令牌、Cookie 或书库内容 |
| 请求监视 | 仅本页内存 | 默认关闭；打开后记录本页发出的 GraphQL 请求的操作名、类型、耗时、结果与变量名，按操作汇总次数、失败与耗时。不记变量值、请求头和返回内容，最多 200 条，刷新即清空 |
| 批量导入 · 预演 | 请求来源，服务端记录作品 | 逐页请求漫画来源（不并发、有间隔与页数上限）。Suwayomi 会把取到的作品记进自己的数据库，和在「发现」里浏览相同，但不加入书库 |
| 批量导入 · 加入书库 | **写入真实书库** | 预演后再确认才执行，分批提交、有条数上限；停止后不再提交新的批次，连续两批失败自动中止。不提供自动撤销：导入记录只帮助事后定位，需要时导出清单再人工移出 |
| 虚构数据 | 仅本机内存 | 用整页跳转打开大书库演示（100 / 1,000 / 10,000 部，可加边界作品）和各 `/dev/*` 验收页；不登录、不连接服务端，断网或服务端停机时也能用，刷新即恢复 |
| 批量已读 / 未读 | **写入测试服务端** | 只在构建时设了 `SUKIMI_TEST_INSTANCE=1`、声明连独立测试服务端的构建里可用；连日用书库的 Preview 与本地开发只显示停用说明。按整个书库或分类预演要改的作品和话数，确认框再列出服务端版本与账号；每批 100 话、一次最多 5,000 话，可停止，连续两批失败自动中止。标为未读同时把读到的页数归零；不同步追踪网站，不能自动撤销 |
| 清空本地缓存 | 仅本浏览器、本域名 | 清掉书库快照与内存缓存后重新请求；保留登录与偏好。不是服务端回滚，也不清理服务端缓存 |

批量删除、换源、扩展安装卸载、恢复备份、服务端设置等高风险操作不在工具箱提供，需要时使用独立的 Suwayomi 测试实例和数据副本。连独立测试实例时，用 `SUKIMI_TEST_INSTANCE=1`（可配合 `SUKIMI_CHANNEL=preview`）构建或启动开发服务器，工具箱才会提供批量已读 / 未读；这个开关只是构建声明，不会校验对方服务端，不要拿它连日用书库。

## 开发约定

界面文字、代码注释与提交信息使用简体中文。开发与验收使用虚构数据；不要提交环境配置、登录凭据或真实书库数据。改动后运行类型检查与测试，涉及界面、路由或资源时补跑构建；GraphQL 文档变更后重新生成类型。

项目旧名为 Suwayomi Web。为兼容已有登录状态、设置、缓存和历史记录，内部仍保留 `suwayomi-web` 存储名称与部署标记。

## 许可

项目自身代码尚未选择许可证。第三方代码的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
