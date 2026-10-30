# Twisted Vault

Twisted Vault is a private Obsidian-like web vault for markdown notes. It provides nested folders, markdown editing, tabs, split editor/preview mode, tags, daily notes, history, attachments, vault import/export, and Keycloak-based authentication.

The app is intended to run as a Docker Compose stack behind Caddy.

## Features

- Dark Obsidian-style UI.
- Nested folder and note tree with drag-and-drop moves.
- Markdown editor powered by CodeMirror 6.
- Rendered markdown preview with GFM tables, checkboxes, code highlighting, and Mermaid diagrams.
- Open-note tabs and optional split editor/preview panes.
- Autosave, manual save, and local browser drafts for unsaved changes.
- Note history with restore support.
- Quick file switcher and global search.
- Search filters: `tag:`, `folder:`, `title:`, `content:`.
- Tags extracted from `#tag` syntax.
- Daily note and note templates.
- Image uploads through the photo button or clipboard paste (Ctrl+V / Cmd+V), with inline image previews in the editor. PNG, JPEG, GIF and WebP are supported, up to 8 MiB per image.
- Export note as `.md`, `.html`, or PDF through browser print.
- Import/export the whole vault as `.zip`.
- Public read-only share links for individual notes.
- Trash for deleted notes and folders with 30-day retention and manual emptying.
- PostgreSQL backup service and manual backup/restore scripts.

## Stack

- Frontend: React, Vite, TypeScript, CodeMirror, React Markdown.
- Backend: FastAPI, SQLAlchemy, Alembic.
- Auth: Keycloak OIDC.
- Database: PostgreSQL.
- Runtime: Docker Compose, Nginx frontend container.
- External proxy: Caddy.

## Project Layout

```text
backend/          FastAPI app, routers, models, migrations
frontend/         React/Vite frontend and Nginx config
keycloak_config/  Keycloak realm import
keycloak_theme/   Custom Keycloak theme
caddy/            Example Caddy config
scripts/          Backup and restore helpers
backups/          SQL dumps created by backup service
```

## Configuration

Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

Before deploying, change at least:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_HOST`
- `KEYCLOAK_ISSUER_URL`
- `CORS_ORIGINS`
- `VITE_KEYCLOAK_URL`

Optional:

- `TRASH_PURGE_INTERVAL_SECONDS`: how often the backend checks and permanently removes trash items older than 30 days. Default: once per day.

The compose defaults target the `sslip.io` domains already present in the repo. For a real domain, update `.env` and the Caddy config together.

## Run With Docker

The stack expects an external Docker network named `caddy_net`:

```powershell
docker network create caddy_net
```

Start the application:

```powershell
docker compose up -d --build
```

Check containers:

```powershell
docker compose ps
```

Logs:

```powershell
docker compose logs --tail 80 api
docker compose logs --tail 80 web
docker compose logs --tail 80 keycloak
```

The frontend container serves static files through Nginx. API calls are proxied from `/api/` to the backend service.

## Verification

Run the editor regression tests with Node.js 22.6 or newer:

```powershell
cd frontend
npm test
npm run test:browser
```

The browser fixture is at `http://127.0.0.1:5178/tests/editor-images.html`. It uses fake notes and a fake API; no backend or real account is needed. Check image and plain-text paste, delayed and failed uploads, typing during upload/save, switching notes, save/reopen, and undo/redo. In a real note, enter edit mode, place the cursor, and paste a screenshot. Images remain Markdown attachments when saved.

Build API and frontend images:

```powershell
docker compose build api web
```

Compile-check the backend inside Docker:

```powershell
docker run --rm twisted-cloud-api python -m compileall app
```

Run backend unit tests:

```powershell
cd backend
python -m unittest discover tests
```

Smoke-test the built frontend image:

```powershell
docker run --rm -d --name twisted_vault_frontend_check --add-host api:127.0.0.1 -p 18080:80 twisted-cloud-web
Invoke-WebRequest -UseBasicParsing http://localhost:18080/healthz
Invoke-WebRequest -UseBasicParsing http://localhost:18080
docker stop twisted_vault_frontend_check
```

Do not commit or transfer local build artifacts such as:

- `frontend/node_modules`
- `frontend/.npm-cache`
- `frontend/dist`

## Database Migrations

Alembic migrations live in `backend/migrations/versions`.

Current notable migrations:

- `0001_initial`: users, folders, notes, goals, note versions.
- `0002_media`: media attachments.
- `0003_public_shares`: public read-only note share links.
- `0004_trash`: soft-delete timestamps for notes and folders.

The backend image includes the migration files. Apply migrations using the project’s deployment flow before serving new code against an existing database.

## API Overview

Authenticated endpoints:

- `GET /api/folders`
- `POST /api/folders`
- `PUT /api/folders/{folder_id}`
- `DELETE /api/folders/{folder_id}`
- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`
- `GET /api/notes/{note_id}/versions`
- `POST /api/notes/{note_id}/versions/{version_id}/restore`
- `GET /api/notes/{note_id}/export`
- `GET /api/search?q=...`
- `GET /api/trash`
- `POST /api/trash/notes/{note_id}/restore`
- `POST /api/trash/folders/{folder_id}/restore`
- `DELETE /api/trash/notes/{note_id}`
- `DELETE /api/trash/folders/{folder_id}`
- `DELETE /api/trash`
- `POST /api/media`
- `GET /api/vault/export.zip`
- `POST /api/vault/import`
- `POST /api/shares/notes/{note_id}`
- `DELETE /api/shares/notes/{note_id}`

Public endpoints:

- `GET /api/public/shares/{token}`
- `GET /share/{token}` served by the frontend app

Legacy goal endpoints still exist in the backend, but the current UI is focused on the markdown vault.

## Backups

The `backup` service writes PostgreSQL dumps to `./backups`. It checks the newest existing `twisted-vault-*.sql` file and creates a new dump only when it is older than `BACKUP_INTERVAL_SECONDS`. Default: once per day. This prevents restart loops from creating many backups in one day. Only the newest `BACKUP_KEEP_COUNT` dumps are retained. Default: 30.

Manual backup on Linux:

```bash
sh scripts/backup.sh
```

Manual restore on Linux:

```bash
sh scripts/restore.sh backups/twisted-vault-YYYYmmdd-HHMMSS.sql
```

Manual backup on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
```

Manual restore on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1 .\backups\twisted-vault-YYYYmmdd-HHMMSS.sql
```

## Current Technical Debt

The frontend build currently bundles CodeMirror and markdown preview dependencies into large chunks. This is acceptable for now, but later the editor and preview should be loaded lazily so the first page load downloads less JavaScript.

Recommended future improvement:

- Lazy-load CodeMirror only when edit mode opens.
- Lazy-load Mermaid only when a note contains a Mermaid code block.
- Split preview/editor bundles with `React.lazy` or dynamic `import()`.
- Track Mermaid's DOMPurify dependency updates. Mermaid diagrams render in a sandboxed iframe, but `npm audit --omit dev` still reports moderate DOMPurify advisories through Mermaid until upstream releases a fixed dependency chain.
