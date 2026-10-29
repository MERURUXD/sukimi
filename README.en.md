# Sukimi

**English** | [简体中文](README.md)

A liquid-glass web client for [Suwayomi Server](https://github.com/Suwayomi/Suwayomi-Server), designed for both desktop and mobile.

**Language**: the interface is available in Simplified Chinese and English. Switch it at the top right of the login page or under "Settings → Appearance". Code comments and commit messages are in Simplified Chinese.

![Home](docs/screenshots/home.png)

| Library (light) | Manga details |
| --- | --- |
| ![Library, light theme](docs/screenshots/library-light.png) | ![Manga details](docs/screenshots/detail.png) |

All screenshots use the built-in fictional demo data (see [Try it without a server](#try-it-without-a-server)).

## Server requirements

- **Suwayomi Server stable v2.4.2366.** Multi-user support needs the preview build v2.4.2379 or later (see [Multi-user](#multi-user)).
- Set the login mode (`server.authMode`) to `UI_LOGIN`. No-login, Basic Auth and other modes are not supported.
- Recommended: let the server host this frontend as a `CUSTOM` WebUI. See [Deployment](#deployment).

## Features

- Home page with continue reading, recent updates and reading history.
- Library filtering, sorting, categories and bulk actions.
- Single-page, double-page, vertical continuous and Webtoon reading, with touch paging and zoom.
- While reading: keep screen awake, auto-crop white margins, split wide pages in two, image filters (brightness / warm / grayscale / invert), save or share the current page, page bookmarks. The reading mode remembered per manga can differ between phone, tablet and desktop.
- Source browsing and filtering, extension management, source migration.
- Reading history, download queue and third-party tracking.
- Multi-user: registration codes, password recovery and change, an admin "Users" page. Library preferences and caches are kept per account, and entry points follow account permissions (see below).
- Light and dark themes, frosted glass, liquid refraction and an opaque appearance.

Extension install, source migration, and tracker authorization and sync still need to be verified against a real server. Touch gestures and animation feel still need to be confirmed on real devices.

## Multi-user

The server's user account feature (Suwayomi-Server PR #623) is only in the preview build (v2.4.2379 and later); the stable v2.4.2366 does not include it. Upgrading to the preview runs an irreversible database migration, so back up first. This section will be updated once a stable release ships it.

- **Older servers**: if the current user cannot be looked up, the app runs as a single-user admin and hides registration, password change and the "Users" page. Local preferences keep using the original storage keys.
- **Registration and recovery**: an admin generates a registration code in "Settings → Users"; the invitee clicks "Register with a code" on the login page (or opens `/register?code=…`) and picks a username and password. For a forgotten password, the admin generates a recovery code and the user sets a new password at `/recover`. A code is shown only once.
- **Local data**: preferences such as library view and reader settings, plus library snapshots, are kept per account; appearance settings are shared by the whole device. After upgrading, the first account to sign in inherits the existing preferences; other accounts start from defaults.
- **Permissions**: extension install / uninstall, downloads, server settings and similar entry points follow account permissions; permission changes take up to 5 minutes to apply. OPDS, sync, auto-download and similar settings belong to each account, while source preferences and download queue controls are still shared by all users.

## Local development

You need Node.js 24, pnpm 11.22.0 and a Suwayomi Server that meets the [server requirements](#server-requirements).

1. Run `pnpm install --frozen-lockfile` to install dependencies.
2. Copy `.env.example` to `.env.local` and set `SUWAYOMI_URL` to your server's address.
3. Run `pnpm dev` and open the address shown in the terminal.
4. Enter your Suwayomi account and password yourself on the login page.

`.env.local` is not committed to Git. Never put accounts, passwords, tokens or real library data in the repository.

## Checks and build

```sh
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm codegen` after adding or changing GraphQL documents. `pnpm schema` fetches the schema again from the configured server.

## Try it without a server

Click "Try the demo without logging in" on the login page, or go to `/demo/`. The demo covers home, library, details, reader, updates, discover and reading history. It uses 12 fictional titles, original geometric covers and locally generated reading pages, works in both development and production builds, and needs no Suwayomi Server.

The demo uses its own in-memory data and separate appearance / reading / library settings. It does not read the login session or library snapshot and never contacts a real server. Search, categories, read state, bookmarks and reading progress can be tried in the demo; the library and progress reset on refresh. In the demo's "Settings → Account" you can switch between a fictional admin and a regular user to see the "Users" page and permission-based entry points; any action that changes accounts is rejected. Downloads, extension install, source migration, tracking, backups and server configuration require leaving the demo and logging in. For static hosting, route `/demo/*` and the other page routes back to `index.html`.

Development mode provides acceptance pages that use only fictional data and need no login: `/dev/source-filters`, `/dev/extensions`, `/dev/migrate`, `/dev/history`, `/dev/downloads`, `/dev/tracking`, `/dev/reader-gestures`, `/dev/settings-layout/:tab?` and `/dev/devtools`. Local development and Preview builds include these pages; production builds do not.

Local development and Preview builds also support two URL parameters for the demo, read once on entry: `/demo/library?scale=1000` generates the given number of extra fictional titles on top of the demo library (up to 10,000; above 1,000 titles the chapters per title are reduced proportionally), and `&edge=1` adds edge cases (very long titles, no cover, broken cover, 5,000 chapters, zero chapters, mixed scripts, and no / multiple categories). Production builds ignore both parameters.

Cloud development environments can run type checks, tests, builds and the fictional-data pages. `localhost` in the cloud does not point to your computer, so connecting to a local Suwayomi Server needs separate network access.

## Deployment

The recommended setup is to let Suwayomi Server host Sukimi as a `Custom` WebUI. This keeps the frontend and `/api` on the same origin, without an additional reverse proxy. Sukimi is a static frontend: **end users do not need Node.js or pnpm**. Serve it at the site root (`server.webUISubpath = ""`); deploying directly under `/sukimi/` or another subpath is not currently supported.

The [`webui-latest` release](https://github.com/MERURUXD/sukimi/releases/tag/webui-latest) is a rolling pre-release built from `main`. It provides `sukimi-webui.zip` for easy desktop extraction and `sukimi-webui.tar` for command-line use. The `sha256` field in `sukimi-webui.json` verifies the TAR; `zipSha256` verifies the ZIP.

### Desktop: Suwayomi Launcher (recommended)

On Windows, macOS or desktop Linux with an existing Suwayomi Server installation, there is no need to edit `server.conf` manually:

1. **Stop Suwayomi Server**. Use the Launcher's `Root Directory` tab to locate the actual data directory (containing `server.conf`); back up its `server.conf` and existing `webUI/`.
2. Download `sukimi-webui.zip` and extract its **contents** directly into `webUI/`, replacing the old frontend. Verify that `webUI/index.html` exists directly, without an extra `dist/` or `sukimi-webui/` directory.
3. In the official [Suwayomi Launcher](https://github.com/Suwayomi/Suwayomi-Launcher), open the `WebUI` tab, enable `WebUI`, and set `WebUI Flavor` to `Custom`. In the `Authentication` tab, select `UI_LOGIN` if it is not already selected.
4. Click `Launch` and open your usual Suwayomi URL.

The Launcher can select `Custom` but **does not download or update Sukimi**. For future updates, replace the `webUI/` files and restart the server.

### Linux / VPS: headless deployment

**No Launcher is needed** on a headless server. For a native Java or systemd installation, stop Suwayomi first and set the following in the actual data directory's `server.conf`:

```hocon
server.webUIEnabled = true
server.webUIFlavor = "Custom"
server.authMode = "ui_login"
server.webUISubpath = ""
server.systemTrayEnabled = false
server.initialOpenInBrowserEnabled = false
```

Download `sukimi-webui.tar` from the release above to the server. From the directory containing the TAR, run the following with the **actual Suwayomi data path**, while the server is stopped:

```sh
DATA_DIR=/path/to/Tachidesk
# Keep the previous frontend for rollback
if [ -d "$DATA_DIR/webUI" ]; then
  mv "$DATA_DIR/webUI" "$DATA_DIR/webUI.bak.$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$DATA_DIR/webUI"
tar -xf sukimi-webui.tar -C "$DATA_DIR/webUI"
test -f "$DATA_DIR/webUI/index.html"
```

Start Suwayomi using your installation's service manager (for systemd, restart the actual service unit). Only static files are deployed; **do not run `pnpm dev` or keep Vite running on the VPS**. For internet-facing servers, use HTTPS at your reverse proxy and keep `UI_LOGIN` enabled.

### Docker Compose (Linux / NAS)

If you already use the [official Suwayomi Docker image](https://github.com/Suwayomi/Suwayomi-Server-docker), keep your existing Compose setup and ensure these fields are present in the `suwayomi` service (**this is a partial snippet, not a complete Compose file**):

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

Here `./data` is the **host-side data directory** (relative to the Compose project). If you already have a different host path or a named volume, keep your mapping and locate `server.conf` and `webUI/` in that data volume. For a fresh setup, start Suwayomi once to initialize its data directory.

1. Run `docker compose stop suwayomi` and back up the host data directory's `server.conf` and `webUI/`.
2. Extract `sukimi-webui.tar` into the host data directory's `webUI/` (use the Linux commands above with `DATA_DIR` set to the mapped host path).
3. Run `docker compose up -d suwayomi`. There is no need for Node.js in the container or a separate Sukimi container.

Docker environment variables override the corresponding server configuration when the container starts. Leaving `WEB_UI_FLAVOR=WebUI` may cause the official frontend to replace your extracted files.

**Rollback:** Stop the server, restore the backed-up `webUI/` and restart to restore the previous files. To switch to the official WebUI instead, select `WebUI` in the Launcher, or set `server.webUIFlavor = "WebUI"` (or Docker's `WEB_UI_FLAVOR`) and restart. Switching to the official WebUI does not guarantee the exact previous official WebUI version.

### Deploying from source

The production build is written to `dist/`. `pnpm deploy:server` builds and copies the files into `webUI/` under the data directory given by `SUWAYOMI_DATA` in `.env.local`. On the first deployment, the existing official WebUI is backed up whole to `webUI-official-<timestamp>`. Back up `server.conf` first, confirm `server.webUIFlavor = CUSTOM`, and get authorization to operate the server. The script also updates the temporary copy the running server uses, which usually takes effect without a restart; if that copy cannot be found, a restart is still needed.

For a local Windows Java install, run `pnpm restart:server -WhatIf` for a pre-check, then `pnpm restart:server` to restart. The script verifies the process identity, backs up the configuration and frontend, and checks the HTTP response after startup. It does not elevate privileges on its own, and the backup does not include the running database. Windows services and other install types should use their own service management tools.

### Preview environment (optional)

If you want to test in-progress changes against a real library without replacing your daily build, you can host a separate Preview frontend on another subdomain, sharing the same Suwayomi:

- **A shared backend means shared data. It is not a sandbox.** Both frontends read and write the same server data: changes to reading progress, bookmarks, categories, downloads, sources, extensions, tracking and server settings affect each other, and switching accounts does not isolate them. Confirmation dialogs in Preview add a reminder about this. Run destructive tests such as deletion, source migration, extension install / uninstall and backup restore on a separate Suwayomi test instance with a copy of the data.
- **Browser-local state is separate.** The two subdomains are different origins: the login cookie (no Domain attribute), renewal token, preferences and local library snapshot are stored independently, so logging out or clearing the cache in Preview does not affect the daily build.
- **Build**: run `pnpm build` with `SUKIMI_CHANNEL=preview`. The page then shows a persistent "Preview · commit" badge, the title gets a `[Preview]` prefix, and search engine indexing is disabled. The repository's `webui-preview` workflow builds automatically when the `preview` branch is pushed or a branch is specified manually, and publishes to the `webui-preview` pre-release; the daily build is still published from `main` to `webui-latest`, so the two never overwrite each other.
- **Hosting**: serve the static files from a reverse proxy, forward `/api/*` (including WebSocket) to the same Suwayomi, and fall back front-end routes to `index.html`. See [deploy/preview/Caddyfile.example](deploy/preview/Caddyfile.example). The frontend sends its own Bearer token when calling the API, so a password at the proxy layer protects only the pages and static assets; `/api` is still protected by Suwayomi's own login.
- **Updates and rollback**: [deploy/preview/update-preview.sh](deploy/preview/update-preview.sh) fetches `webui-preview`, verifies the hash and switches to the new version directory. It writes only to the Preview directory and never calls `pnpm deploy:server`, which would overwrite the server's `webUI/`. `--rollback` switches back to the previous copy, and the latest 5 copies are kept by default. It can be paired with a scheduled task for automatic updates.

#### Developer toolbox

Preview builds (and local development) add a "Developer toolbox" entry under "Settings → About", at the path `/devtools`, available after login. Production builds neither register this route nor bundle its code. Like the rest of Preview, the toolbox is connected to the daily-use Suwayomi. The impact of each tool:

| Tool | Scope | Notes |
| --- | --- | --- |
| Environment diagnostics | Read-only | Shows the frontend commit, build time, server version, live connection and request latency; never shows tokens, cookies or library content |
| Request monitor | This page's memory only | Off by default. When on, records the operation name, type, duration, result and variable names of GraphQL requests sent from this page, and summarizes count, failures and duration per operation. Variable values, headers and responses are not recorded; at most 200 entries; cleared on refresh |
| Bulk import · dry run | Requests sources; server records titles | Requests the source page by page (no concurrency, with intervals and a page limit). Suwayomi records the fetched titles in its own database, same as browsing in "Discover", but does not add them to the library |
| Bulk import · add to library | **Writes to the real library** | Runs only after a dry run and a confirmation; submitted in batches with a count limit. After stopping, no new batch is submitted, and it aborts automatically after two consecutive batch failures. There is no automatic undo: the import record only helps locate items afterwards, and you can export the list and remove them manually if needed |
| Fictional data | This device's memory only | Opens the large-library demo (100 / 1,000 / 10,000 titles, optionally with edge cases) and the `/dev/*` acceptance pages through a full-page navigation; no login, no server connection, works offline or with the server down, and resets on refresh |
| Bulk mark read / unread | **Writes to the test server** | Available only in builds made with `SUKIMI_TEST_INSTANCE=1`, which declares a connection to a separate test server; Preview and local development connected to the daily library only show a note that it is disabled. Dry-runs the titles and chapters to change for the whole library or a category, then the confirmation dialog lists the server version and account; 100 chapters per batch, at most 5,000 chapters at a time, stoppable, and aborts automatically after two consecutive batch failures. Marking unread also resets the page count read to zero; tracker sites are not synced, and there is no automatic undo |
| Clear local cache | This browser and domain only | Clears the library snapshot and in-memory cache, then requests data again; login and preferences are kept. It is not a server rollback and does not clear server caches |

High-risk operations such as bulk deletion, source migration, extension install / uninstall, backup restore and server settings are not provided in the toolbox; use a separate Suwayomi test instance with a copy of the data. When connecting to a separate test instance, build or start the dev server with `SUKIMI_TEST_INSTANCE=1` (optionally with `SUKIMI_CHANNEL=preview`) to get bulk mark read / unread in the toolbox. This switch is only a build declaration and does not verify the server on the other end, so never use it against your daily library.

## Contributing

Code comments and commit messages are written in Simplified Chinese; UI text lives in `src/i18n/` in both Simplified Chinese and English. Development and acceptance use fictional data; do not commit environment configuration, login credentials or real library data. After changes, run the type check and tests, and run a build when UI, routing or assets are involved; regenerate types after GraphQL document changes.

The project was formerly named Suwayomi Web. To stay compatible with existing login state, settings, caches and history, the internal `suwayomi-web` storage names and deployment markers are kept.

## License

The project's own code has not yet been given a license. For the origin and licenses of third-party code, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
