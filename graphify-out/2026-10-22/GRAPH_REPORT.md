# Graph Report - twisted-cloud  (2026-10-22)

## Corpus Check
- 48 files · ~13,890 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: (none) 8, .ftl 4, .css 2)

## Summary
- 461 nodes · 1060 edges · 26 communities (18 shown, 8 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 124 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- security.py
- User
- NotesView.tsx
- NotesView
- package.json
- MarkdownPreview.tsx
- Note
- compilerOptions
- dependencies
- editor-images-server.mjs
- backup-loop.sh
- keycloak-init.sh
- backup.sh script
- restore.sh script
- editorImages.ts
- goals.py
- devDependencies
- scripts
- Twisted Vault
- create_share
- export_vault
- ImageWidget

## God Nodes (most connected - your core abstractions)
1. `User` - 64 edges
2. `NotesView()` - 60 edges
3. `Note` - 31 edges
4. `Folder` - 25 edges
5. `get_settings()` - 18 edges
6. `showError()` - 17 edges
7. `compilerOptions` - 16 edges
8. `require_user()` - 15 edges
9. `get_db()` - 13 edges
10. `hard_delete_folder()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `startup()` --uses--> `User`  [INFERRED]
  backend/app/main.py → backend/app/models.py
- `login()` --uses--> `User`  [INFERRED]
  backend/app/routers/auth.py → backend/app/models.py
- `register()` --uses--> `User`  [INFERRED]
  backend/app/routers/auth.py → backend/app/models.py
- `create_goal()` --uses--> `User`  [INFERRED]
  backend/app/routers/goals.py → backend/app/models.py
- `delete_goal()` --uses--> `User`  [INFERRED]
  backend/app/routers/goals.py → backend/app/models.py

## Import Cycles
- None detected.

## Communities (26 total, 8 thin omitted)

### Community 0 - "security.py"
Cohesion: 0.06
Nodes (35): get_settings(), Settings, get_db(), health(), start_trash_purger(), startup(), stop_trash_purger(), trash_purge_loop() (+27 more)

### Community 1 - "User"
Cohesion: 0.12
Nodes (29): Folder, PublicShare, User, me(), create_folder(), delete_folder(), ensure_parent(), list_folders() (+21 more)

### Community 2 - "NotesView.tsx"
Cohesion: 0.05
Nodes (55): api(), downloadFromApi(), errorMessage(), App(), NotesView, initAuth(), keycloak, logout() (+47 more)

### Community 3 - "NotesView"
Cohesion: 0.08
Nodes (44): downloadText(), escapeHtml(), NotesView(), closeTab(), createFromTemplate(), createNote(), createShare(), deleteItem() (+36 more)

### Community 4 - "package.json"
Cohesion: 0.15
Nodes (12): name, overrides, uuid, private, type, version, keycloak-js, @types/react (+4 more)

### Community 5 - "MarkdownPreview.tsx"
Cohesion: 0.28
Nodes (7): escapeHtml(), MermaidBlock(), mermaidDocument(), mermaid, react-markdown, rehype-highlight, remark-gfm

### Community 6 - "Note"
Cohesion: 0.21
Nodes (14): Base, Note, NoteVersion, create_note(), delete_note(), ensure_folder(), export_note(), list_notes() (+6 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 8 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @codemirror/commands, @codemirror/lang-markdown, @codemirror/language, @codemirror/state, @codemirror/view, keycloak-js, lucide-react (+7 more)

### Community 10 - "editor-images-server.mjs"
Cohesion: 0.22
Nodes (3): header, pixels, png

### Community 11 - "backup-loop.sh"
Cohesion: 0.70
Nodes (4): create_backup(), latest_backup_mtime(), prune_old_backups(), backup-loop.sh script

### Community 18 - "editorImages.ts"
Cohesion: 0.13
Nodes (18): addImageUpload, decorateImages(), imagePreviews, imageUploadPlugin(), PendingImage, pendingImages, removeImageUpload, UploadImage (+10 more)

### Community 19 - "goals.py"
Cohesion: 0.19
Nodes (9): Goal, create_goal(), delete_goal(), list_goals(), update_goal(), search(), snippet(), GoalIn (+1 more)

### Community 20 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react

### Community 21 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, test:browser

### Community 22 - "Twisted Vault"
Cohesion: 0.17
Nodes (11): API Overview, Backups, Configuration, Current Technical Debt, Database Migrations, Features, Project Layout, Run With Docker (+3 more)

### Community 23 - "create_share"
Cohesion: 0.25
Nodes (3): create_share(), read_public_note(), revoke_share()

### Community 24 - "export_vault"
Cohesion: 0.28
Nodes (4): export_vault(), folder_path(), import_vault(), safe_name()

## Knowledge Gaps
- **3 isolated node(s):** `@types/react`, `@types/react-dom`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 174 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `User` to `security.py`, `Note`, `goals.py`, `create_share`, `export_vault`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 46 inferred relationships involving `User` (e.g. with `startup()` and `login()`) actually correct?**
  _`User` has 46 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/react`, `@types/react-dom`, `typescript` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `security.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05605124685426676 - nodes in this community are weakly interconnected._
- **Why does `NotesView()` connect `NotesView` to `NotesView.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `Note` (e.g. with `upload_media()` and `create_note()`) actually correct?**
  _`Note` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.12056737588652482 - nodes in this community are weakly interconnected._