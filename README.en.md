# Sukimi

A liquid-glass manga web client for [Suwayomi Server](https://github.com/Suwayomi/Suwayomi-Server), designed for desktop and mobile.

[简体中文](README.md) · The interface supports Simplified Chinese and English.

![Home](docs/screenshots/home.png)

| Library (light theme) | Manga details |
| --- | --- |
| ![Library](docs/screenshots/library-light.png) | ![Manga details](docs/screenshots/detail.png) |

## Features

- **Library:** Categories, filters, sorting, bulk actions, recent updates, and continue reading.
- **Reader:** Single-page, double-page, vertical continuous, and Webtoon modes; touch gestures, zoom, auto-cropping, splitting wide pages, and image filters.
- **Reading progress:** History, progress, bookmarks, and device-specific reading preferences.
- **Content:** Source browsing, extension management, source migration, download queue, and third-party tracking.
- **Appearance:** Light and dark themes, liquid glass, and an opaque mode.
- **Multi-user:** Registration and recovery, admin user management, and per-account preferences and caches (requires a Suwayomi Server build with multi-user support).

## Requirements

- Suwayomi Server v2.4.2366 or later.
- Server authentication mode set to `UI_LOGIN`.
- Multi-user features require a server build with user accounts (available in preview builds from v2.4.2379). Back up your server data before upgrading from an older version.

## Installation

Download a build from the [webui-latest Release](https://github.com/MERURUXD/sukimi/releases/tag/webui-latest).

### Windows / macOS / desktop Linux

1. Stop Suwayomi. Find the data directory under `Root Directory` in the Launcher, then back up `server.conf` and `webUI/`.
2. Empty the data directory's `webUI/` and extract the **contents** of `sukimi-webui.zip` directly into it. Check that `webUI/index.html` exists.
3. In [Suwayomi Launcher](https://github.com/Suwayomi/Suwayomi-Launcher), enable WebUI under `WebUI` and set `WebUI Flavor` to `Custom`. Set `Authentication` to `UI_LOGIN`, then click `Launch`.

### Linux / VPS (native Java / systemd)

1. Stop Suwayomi, back up `server.conf` in the data directory, and set:

   ```hocon
   server.webUIEnabled = true
   server.webUIFlavor = "Custom"
   server.authMode = "ui_login"
   server.webUISubpath = ""
   ```

2. Download `sukimi-webui.tar` to the server. In the directory containing the archive, run (replace the data directory path):

   ```sh
   DATA_DIR=/path/to/Tachidesk
   if [ -d "$DATA_DIR/webUI" ]; then
     mv "$DATA_DIR/webUI" "$DATA_DIR/webUI.bak.$(date +%Y%m%d-%H%M%S)"
   fi
   mkdir -p "$DATA_DIR/webUI"
   tar -xf sukimi-webui.tar -C "$DATA_DIR/webUI"
   test -f "$DATA_DIR/webUI/index.html"
   ```

3. Start Suwayomi using your existing launch method (or the corresponding systemd service).

### Docker Compose (Linux / NAS)

In your existing [Suwayomi Docker Compose](https://github.com/Suwayomi/Suwayomi-Server-docker), set:

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

1. Run `docker compose stop suwayomi` and back up `server.conf` and `webUI/` in the host data directory.
2. Extract `sukimi-webui.tar` into the host's `./data/webUI/`, with `index.html` directly inside that directory.
3. Run `docker compose up -d suwayomi`.

This example uses the `./data` bind mount. If your setup already uses another host directory or a named volume, operate on that data volume instead of changing the existing mount.

**Update:** Stop Suwayomi, back up and replace `webUI/`, then restart. **Rollback:** Stop the server and restore the backup. To switch to the official frontend, change `WebUI Flavor` to `WebUI` (or `WEB_UI_FLAVOR` in Docker).

## Demo

In an installed Sukimi instance, select “Try the demo without logging in” on the login page, or open `/demo/`. Browse and read a fictional library; demo progress resets on refresh.

## Local development

Requires Node.js 24 and pnpm 11.22.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set SUWAYOMI_URL in .env.local
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm codegen` after editing GraphQL documents, or `pnpm schema` to refresh the server schema.

### Preview builds

Build a preview with `SUKIMI_CHANNEL=preview pnpm build`, or download one from the [webui-preview Release](https://github.com/MERURUXD/sukimi/releases/tag/webui-preview). For separate hosting, see the [Caddy example](deploy/preview/Caddyfile.example) and [update script](deploy/preview/update-preview.sh).

A Preview connected to the same Suwayomi Server **shares all server-side data** with your everyday frontend. Use a separate server instance for isolated tests.

## License

The project does not yet have a license. Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
