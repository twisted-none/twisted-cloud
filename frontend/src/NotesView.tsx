import React, { useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Download, Eraser, FileArchive, FilePlus2, Files, Folder as FolderIcon, History, Image, Link, LogOut, MoreVertical, Move, Pencil, RotateCcw, Save, Search, Settings, Tag, Trash2, Upload, X } from "lucide-react";
import { api, downloadFromApi, downloadText } from "./api";
import MarkdownCodeEditor, { type MarkdownCodeEditorHandle } from "./MarkdownCodeEditor";
import MarkdownPreview from "./MarkdownPreview";
import type { Attachment, Folder, Note, NoteVersion, PublicShare, SearchResult, TrashItem, VaultImportResult } from "./types";

type Props = { token: string; folders: Folder[]; notes: Note[]; setFolders: (v: Folder[]) => void; setNotes: (v: Note[]) => void; reload: () => Promise<void>; account: string; onLogout: () => void };
type ItemRef = { kind: "folder" | "note"; id: number };
type RootRef = { kind: "root"; id: null };
type MenuTarget = ItemRef | RootRef;
type Dialog = { kind: "folder"; parentId: number | null } | { kind: "rename-folder"; folder: Folder } | { kind: "rename-note"; note: Note } | null;
type Menu = { x: number; y: number; target: MenuTarget } | null;
type Palette = { mode: "file" | "global"; query: string } | null;
type MoveState = { target: ItemRef } | null;
type SettingsState = { autosaveMs: number; fontSize: number; wideEditor: boolean };

const tagRegex = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
const extractTags = (content: string) => Array.from(content.matchAll(tagRegex), (m) => m[2]).filter(Boolean);
const settingsKey = "twisted-vault-settings";
const templates = [
  { name: "Daily note", title: todayTitle, content: () => `# ${todayTitle()}\n\n## Задачи\n- \n\n## Заметки\n` },
  { name: "Meeting", title: () => "Встреча", content: () => "# Встреча\n\n## Участники\n\n## Решения\n\n## Следующие шаги\n" },
  { name: "Project", title: () => "Проект", content: () => "# Проект\n\n## Цель\n\n## Статус\n#project\n\n## План\n" },
];

export default function NotesView({ token, folders, notes, setFolders, setNotes, reload, account, onLogout }: Props) {
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(notes[0] || null);
  const [selected, setSelected] = useState<ItemRef | null>(notes[0] ? { kind: "note", id: notes[0].id } : null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [paletteResults, setPaletteResults] = useState<SearchResult[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogName, setDialogName] = useState("");
  const [status, setStatus] = useState("Готово");
  const [dirty, setDirty] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<Menu>(null);
  const [palette, setPalette] = useState<Palette>(null);
  const [moveState, setMoveState] = useState<MoveState>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<number[]>(() => notes[0] ? [notes[0].id] : []);
  const [splitView, setSplitView] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const mdImportRef = useRef<HTMLInputElement>(null);
  const vaultImportRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MarkdownCodeEditorHandle>(null);
  const [pendingImages, setPendingImages] = useState(0);
  const activeNoteRef = useRef(activeNote);
  activeNoteRef.current = activeNote;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const noteTags = useMemo(() => new Map(notes.map((n) => [n.id, extractTags(n.content)])), [notes]);
  const allTags = useMemo(() => Array.from(new Set(Array.from(noteTags.values()).flat())).sort((a, b) => a.localeCompare(b)), [noteTags]);
  const visibleNotes = useMemo(() => activeTag ? notes.filter((n) => noteTags.get(n.id)?.includes(activeTag)) : notes, [activeTag, notes, noteTags]);
  const childFolders = useMemo(() => groupByParent(folders, "parent_id"), [folders]);
  const childNotes = useMemo(() => groupByParent(visibleNotes, "folder_id"), [visibleNotes]);

  useEffect(() => { if (!activeNote && notes[0]) { const note = withDraft(notes[0]); setActiveNote(note); setSelected({ kind: "note", id: note.id }); setOpenTabs([note.id]); } }, [notes, activeNote]);
  useEffect(() => { if (query.trim()) void api<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`, token).then(setResults).catch(showError); else setResults([]); }, [query, token]);
  useEffect(() => {
    if (!palette || palette.mode !== "global" || !palette.query.trim()) { setPaletteResults([]); return; }
    const timer = window.setTimeout(() => void api<SearchResult[]>(`/search?q=${encodeURIComponent(palette.query)}`, token).then(setPaletteResults).catch(showError), 200);
    return () => window.clearTimeout(timer);
  }, [palette, token]);
  useEffect(() => {
    if (!dirty || !activeNote) return;
    const timer = window.setInterval(() => void saveNote(activeNote, false), settings.autosaveMs);
    return () => window.clearInterval(timer);
  }, [activeNote, dirty, settings.autosaveMs]);
  useEffect(() => {
    if (!historyOpen || !activeNote) return;
    void api<NoteVersion[]>(`/notes/${activeNote.id}/versions`, token).then(setVersions).catch(showError);
  }, [historyOpen, activeNote?.id, token]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "n") { event.preventDefault(); openDialog("folder", activeFolder); }
      else if (event.altKey && event.key.toLowerCase() === "n") { event.preventDefault(); void createNote(activeFolder); }
      if (event.altKey && event.key.toLowerCase() === "o") { event.preventDefault(); openPalette("file"); }
      if (event.altKey && event.key.toLowerCase() === "f") { event.preventDefault(); openPalette("global"); }
      if (event.altKey && event.key.toLowerCase() === "e") { event.preventDefault(); void toggleEditor(); }
      if (event.altKey && event.key.toLowerCase() === "p") { event.preventDefault(); openPalette("file"); }
      if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); if (activeNote) void saveNote(activeNote); }
      if (event.key === "F2") { event.preventDefault(); renameSelected(); }
      if (event.key === "Delete" && !(event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable=true]"))) { event.preventDefault(); void deleteSelected(); }
      if (event.key === "Escape") { setDialog(null); setContextMenu(null); setMenuOpen(false); setPalette(null); setMoveState(null); setTrashOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeFolder, activeNote, selected, dirty, notes, folders]);

  function showError(error: unknown) { setStatus(error instanceof Error ? error.message : "Ошибка"); }
  function draftKey(noteId: number) { return `twisted-vault-draft-${noteId}`; }
  function withDraft(note: Note) {
    const raw = localStorage.getItem(draftKey(note.id));
    if (!raw) return note;
    try { return { ...note, ...JSON.parse(raw) as Partial<Note> }; } catch { return note; }
  }
  async function persistDraft() { return !dirty || !activeNote || Boolean(await saveNote(activeNote, false)); }
  function setDraft(patch: Partial<Note>) {
    const current = activeNoteRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    activeNoteRef.current = next;
    localStorage.setItem(draftKey(current.id), JSON.stringify({ title: next.title, content: next.content, folder_id: next.folder_id }));
    setDirty(true); setStatus("Черновик"); setActiveNote(next);
  }
  async function saveNote(note: Note, manual = true) {
    try {
      setStatus("Сохранение...");
      const saved = await api<Note>(`/notes/${note.id}`, token, { method: "PUT", body: JSON.stringify(note) });
      setNotes(notesRef.current.map((n) => n.id === saved.id ? saved : n));
      const current = activeNoteRef.current;
      if (current?.id === note.id && current.content === note.content && current.title === note.title && current.folder_id === note.folder_id) {
        localStorage.removeItem(draftKey(saved.id));
        activeNoteRef.current = saved;
        setActiveNote(saved); setDirty(false); setStatus(manual ? "Сохранено" : "Автосохранено");
      }
      return saved;
    } catch (error) { showError(error); return null; }
  }
  function openDialog(kind: "folder", parentId: number | null): void;
  function openDialog(kind: "rename-folder", folder: Folder): void;
  function openDialog(kind: "rename-note", note: Note): void;
  function openDialog(kind: "folder" | "rename-folder" | "rename-note", value: number | null | Folder | Note) {
    if (kind === "folder") { setDialog({ kind, parentId: value as number | null }); setDialogName(""); }
    if (kind === "rename-folder") { const folder = value as Folder; setDialog({ kind, folder }); setDialogName(folder.name); }
    if (kind === "rename-note") { const note = value as Note; setDialog({ kind, note }); setDialogName(note.title); }
    setMenuOpen(false); setContextMenu(null);
  }
  async function submitDialog(e: React.FormEvent) {
    e.preventDefault();
    const name = dialogName.trim();
    if (!dialog || !name) return;
    try {
      if (dialog.kind === "folder") {
        const folder = await api<Folder>("/folders", token, { method: "POST", body: JSON.stringify({ name, parent_id: dialog.parentId }) });
        setFolders([...folders, folder]); setExpanded(new Set(expanded).add(folder.id));
      } else if (dialog.kind === "rename-folder") {
        const updated = await api<Folder>(`/folders/${dialog.folder.id}`, token, { method: "PUT", body: JSON.stringify({ name, parent_id: dialog.folder.parent_id }) });
        setFolders(folders.map((f) => f.id === updated.id ? updated : f));
      } else {
        await saveNote({ ...dialog.note, title: name });
      }
      setDialog(null);
    } catch (error) { showError(error); }
  }
  async function createNote(folderId: number | null = activeFolder) {
    if (!await persistDraft()) return;
    try {
      const note = await api<Note>("/notes", token, { method: "POST", body: JSON.stringify({ title: "Новая заметка", content: "# Новая заметка", folder_id: folderId }) });
      setNotes([note, ...notes]); setActiveNote(note); setSelected({ kind: "note", id: note.id }); setActiveFolder(folderId); setDirty(false); setMenuOpen(false); openTab(note.id);
      if (folderId) setExpanded(new Set(expanded).add(folderId));
    } catch (error) { showError(error); }
  }
  async function openNote(note: Note) {
    if (activeNote?.id === note.id || !await persistDraft()) return;
    const next = withDraft(note);
    setActiveNote(next); setSelected({ kind: "note", id: note.id }); setDirty(next.content !== note.content || next.title !== note.title); setStatus(next.content !== note.content || next.title !== note.title ? "Черновик" : "Готово"); openTab(note.id);
  }
  function openTab(noteId: number) { setOpenTabs((tabs) => tabs.includes(noteId) ? tabs : [...tabs, noteId]); }
  async function closeTab(noteId: number) {
    if (activeNote?.id === noteId && dirty && !await persistDraft()) return;
    setOpenTabs((tabs) => {
      const next = tabs.filter((id) => id !== noteId);
      if (activeNote?.id === noteId) {
        const nextNote = notes.find((n) => n.id === next[next.length - 1]) || null;
        setActiveNote(nextNote ? withDraft(nextNote) : null);
      }
      return next;
    });
  }
  async function createFromTemplate(index: number) {
    const tpl = templates[index];
    if (!tpl || !await persistDraft()) return;
    try {
      const note = await api<Note>("/notes", token, { method: "POST", body: JSON.stringify({ title: tpl.title(), content: tpl.content(), folder_id: activeFolder }) });
      setNotes([note, ...notes]); setActiveNote(note); setSelected({ kind: "note", id: note.id }); setDirty(false); openTab(note.id);
    } catch (error) { showError(error); }
  }
  async function openDailyNote() {
    const title = todayTitle();
    const existing = notes.find((n) => n.title === title);
    if (existing) await openNote(existing); else await createFromTemplate(0);
  }
  async function importMarkdown(file: File) {
    try {
      const content = await file.text();
      const note = await api<Note>("/notes", token, { method: "POST", body: JSON.stringify({ title: file.name.replace(/\.md$/i, ""), content, folder_id: activeFolder }) });
      setNotes([note, ...notes]); setActiveNote(note); setSelected({ kind: "note", id: note.id }); setDirty(false);
    } catch (error) { showError(error); }
  }
  async function importVault(file: File) {
    try {
      const form = new FormData(); form.append("file", file);
      const result = await api<VaultImportResult>("/vault/import", token, { method: "POST", body: form });
      setStatus(`Импортировано: папок ${result.folders}, заметок ${result.notes}`); await reload();
    } catch (error) { showError(error); }
  }
  async function uploadImage(file: File, signal: AbortSignal): Promise<string> {
    if (!activeNote) throw new Error("Сначала откройте заметку");
    const form = new FormData(); form.append("file", file);
    const media = await api<Attachment>(`/media?note_id=${activeNote.id}`, token, { method: "POST", body: form, signal });
    return media.url;
  }
  function onPendingImages(delta: number) {
    setPendingImages((count) => Math.max(0, count + delta));
    if (delta > 0) { setDirty(true); setStatus("Загрузка изображения…"); }
  }
  function showImageError(error: unknown) {
    showError(new Error(`Ошибка загрузки: ${error instanceof Error ? error.message : "не удалось загрузить изображение"}`));
  }
  async function moveFolder(folderId: number, parent_id: number | null) {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder || folder.id === parent_id || isDescendant(parent_id, folder.id)) return;
    try {
      const moved = await api<Folder>(`/folders/${folder.id}`, token, { method: "PUT", body: JSON.stringify({ name: folder.name, parent_id }) });
      setFolders(folders.map((f) => f.id === moved.id ? moved : f)); setActiveFolder(moved.id);
      if (parent_id) setExpanded(new Set(expanded).add(parent_id));
    } catch (error) { showError(error); }
  }
  async function moveNote(noteId: number, folder_id: number | null) {
    const note = notes.find((n) => n.id === noteId); if (!note) return;
    try {
      const moved = await api<Note>(`/notes/${note.id}`, token, { method: "PUT", body: JSON.stringify({ ...note, folder_id }) });
      setNotes(notes.map((n) => n.id === moved.id ? moved : n)); setActiveNote(moved);
      if (folder_id) setExpanded(new Set(expanded).add(folder_id));
    } catch (error) { showError(error); }
  }
  function openMoveDialog(target: ItemRef) {
    setMoveState({ target }); setContextMenu(null);
  }
  async function moveToFolder(parentId: number | null) {
    if (!moveState) return;
    if (moveState.target.kind === "folder") await moveFolder(moveState.target.id, parentId);
    else await moveNote(moveState.target.id, parentId);
    setMoveState(null); setStatus("Перемещено");
  }
  function destinationFolders(target: ItemRef) {
    return folders.filter((folder) => target.kind === "note" || (folder.id !== target.id && !isDescendant(folder.id, target.id)));
  }
  async function openTrash() {
    try {
      const items = await api<TrashItem[]>("/trash", token);
      setTrash(items); setTrashOpen(true); setMenuOpen(false); setContextMenu(null);
    } catch (error) { showError(error); }
  }
  async function restoreTrashItem(item: TrashItem) {
    try {
      await api(item.kind === "folder" ? `/trash/folders/${item.id}/restore` : `/trash/notes/${item.id}/restore`, token, { method: "POST" });
      setTrash(trash.filter((row) => row.kind !== item.kind || row.id !== item.id)); await reload(); setStatus("Восстановлено");
    } catch (error) { showError(error); }
  }
  async function deleteTrashItem(item: TrashItem) {
    if (!window.confirm("Удалить безвозвратно?")) return;
    try {
      await api(item.kind === "folder" ? `/trash/folders/${item.id}` : `/trash/notes/${item.id}`, token, { method: "DELETE" });
      setTrash(trash.filter((row) => row.kind !== item.kind || row.id !== item.id)); setStatus("Удалено безвозвратно");
    } catch (error) { showError(error); }
  }
  async function emptyTrash() {
    if (!window.confirm("Очистить корзину безвозвратно?")) return;
    try {
      await api("/trash", token, { method: "DELETE" });
      setTrash([]); await reload(); setStatus("Корзина очищена");
    } catch (error) { showError(error); }
  }
  async function deleteSelected() {
    if (selected) await deleteItem(selected);
  }
  async function deleteItem(target: ItemRef) {
    if (!window.confirm("Переместить выбранный элемент в корзину?")) return;
    try {
      if (target.kind === "note") {
        await api(`/notes/${target.id}`, token, { method: "DELETE" });
        setNotes(notes.filter((n) => n.id !== target.id)); setOpenTabs(openTabs.filter((id) => id !== target.id)); if (activeNote?.id === target.id) setActiveNote(null);
      } else {
        await api(`/folders/${target.id}`, token, { method: "DELETE" });
        const removed = new Set([target.id, ...descendantFolderIds(target.id)]);
        setFolders(folders.filter((f) => !removed.has(f.id)));
        setNotes(notes.filter((n) => !removed.has(n.folder_id || 0)));
        if (activeNote && removed.has(activeNote.folder_id || 0)) setActiveNote(null);
      }
      setSelected(null); setContextMenu(null); setStatus("В корзине");
    } catch (error) { showError(error); }
  }
  function renameSelected() {
    if (!selected) return;
    const item = selected.kind === "note" ? notes.find((n) => n.id === selected.id) : folders.find((f) => f.id === selected.id);
    if (!item) return;
    selected.kind === "note" ? openDialog("rename-note", item as Note) : openDialog("rename-folder", item as Folder);
  }
  async function toggleEditor() {
    if (!activeNote) return;
    if (dirty) await saveNote(activeNote);
    else { setDirty(true); setStatus("Черновик"); }
  }
  async function restoreVersion(version: NoteVersion) {
    try {
      const restored = await api<Note>(`/notes/${version.note_id}/versions/${version.id}/restore`, token, { method: "POST" });
      setNotes(notes.map((n) => n.id === restored.id ? restored : n)); setActiveNote(restored); setDirty(false); setStatus("Версия восстановлена");
    } catch (error) { showError(error); }
  }
  function updateSettings(next: SettingsState) {
    localStorage.setItem(settingsKey, JSON.stringify(next));
    setSettings(next);
  }
  function exportHtml(note: Note) {
    const body = document.querySelector(".rendered-markdown")?.innerHTML || `<pre>${escapeHtml(note.content)}</pre>`;
    downloadText(`${note.title}.html`, `<!doctype html><meta charset="utf-8"><title>${escapeHtml(note.title)}</title><body>${body}</body>`, "text/html");
  }
  function exportPdf(note: Note) {
    const win = window.open("", "_blank");
    if (!win) { setStatus("Браузер заблокировал окно печати"); return; }
    const body = document.querySelector(".rendered-markdown")?.innerHTML || `<pre style="white-space:pre-wrap">${escapeHtml(note.content)}</pre>`;
    win.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(note.title)}</title><body style="font:16px system-ui;line-height:1.6;max-width:820px;margin:40px auto">${body}<script>print()</script>`);
    win.document.close();
  }
  async function createShare(note: Note) {
    try {
      const share = await api<PublicShare>(`/shares/notes/${note.id}`, token, { method: "POST" });
      setShareUrl(share.url); await navigator.clipboard?.writeText(share.url).catch(() => undefined); setStatus("Публичная ссылка создана");
    } catch (error) { showError(error); }
  }
  function isDescendant(folderId: number | null, parentId: number): boolean {
    if (!folderId) return false;
    const folder = folders.find((f) => f.id === folderId);
    return Boolean(folder && (folder.parent_id === parentId || isDescendant(folder.parent_id, parentId)));
  }
  function descendantFolderIds(parentId: number): number[] {
    const children = folders.filter((f) => f.parent_id === parentId);
    return children.flatMap((f) => [f.id, ...descendantFolderIds(f.id)]);
  }
  function folderPathName(folder: Folder): string {
    const parts = [folder.name];
    let parent = folders.find((f) => f.id === folder.parent_id);
    while (parent) {
      parts.unshift(parent.name);
      parent = folders.find((f) => f.id === parent?.parent_id);
    }
    return parts.join(" / ");
  }
  async function dropIntoFolder(event: React.DragEvent, folderId: number | null) {
    event.preventDefault(); event.stopPropagation(); setDropTarget(null);
    const noteId = Number(event.dataTransfer.getData("note"));
    const movedFolderId = Number(event.dataTransfer.getData("folder"));
    if (noteId) await moveNote(noteId, folderId);
    if (movedFolderId) await moveFolder(movedFolderId, folderId);
  }
  function openContext(event: React.MouseEvent, target: MenuTarget) {
    event.preventDefault(); event.stopPropagation();
    setSelected(target.kind === "root" ? null : target); setContextMenu({ x: event.clientX, y: event.clientY, target });
  }
  function openPalette(mode: "file" | "global") { setPalette({ mode, query: "" }); setPaletteResults([]); }
  function selectSearchResult(result: SearchResult) {
    if (result.kind === "note") void openNote(notes.find((n) => n.id === result.id)!);
    if (result.kind === "folder") { setActiveFolder(result.id); setSelected({ kind: "folder", id: result.id }); setExpanded(new Set(expanded).add(result.id)); }
    setResults([]); setQuery(""); setPalette(null);
  }
  function smartResults(raw: string) {
    const parts = raw.trim().split(/\s+/);
    const filters = new Map<string, string>();
    const terms: string[] = [];
    for (const part of parts) {
      const match = /^(tag|folder|title|content):(.+)$/i.exec(part);
      if (match) filters.set(match[1].toLowerCase(), match[2].toLowerCase());
      else if (part) terms.push(part.toLowerCase());
    }
    return notes.filter((note) => {
      const folder = folders.find((f) => f.id === note.folder_id);
      const haystack = `${note.title} ${note.content}`.toLowerCase();
      return terms.every((term) => haystack.includes(term))
        && (!filters.has("tag") || noteTags.get(note.id)?.some((tag) => tag.toLowerCase().includes(filters.get("tag")!)))
        && (!filters.has("folder") || folder?.name.toLowerCase().includes(filters.get("folder")!))
        && (!filters.has("title") || note.title.toLowerCase().includes(filters.get("title")!))
        && (!filters.has("content") || note.content.toLowerCase().includes(filters.get("content")!));
    }).slice(0, 25).map((n) => ({ kind: "note", id: n.id, title: n.title, snippet: n.content } as SearchResult));
  }
  function folderHasVisibleContent(folderId: number): boolean {
    return Boolean(childNotes.get(folderId)?.length || childFolders.get(folderId)?.some((f) => folderHasVisibleContent(f.id)));
  }
  function renderTree(parentId: number | null) {
    const folderList = (childFolders.get(parentId) || []).filter((f) => !activeTag || folderHasVisibleContent(f.id));
    const noteList = childNotes.get(parentId) || [];
    return <>
      {folderList.map((f) => {
        const isOpen = expanded.has(f.id);
        return <div className="tree-node" key={`folder-${f.id}`} draggable onDragStart={(e) => e.dataTransfer.setData("folder", String(f.id))} onContextMenu={(e) => openContext(e, { kind: "folder", id: f.id })}>
          <div className={`tree-row-wrap ${dropTarget === f.id ? "drop-target" : ""}`} onDrop={(e) => void dropIntoFolder(e, f.id)} onDragEnter={() => setDropTarget(f.id)} onDragOver={(e) => e.preventDefault()}>
            <button className={`file-row ${selected?.kind === "folder" && selected.id === f.id ? "active" : ""}`} onClick={() => { setSelected({ kind: "folder", id: f.id }); setActiveFolder(f.id); setExpanded(toggleSet(expanded, f.id)); }}><FolderIcon size={15}/><span>{f.name}</span></button>
            <button className="icon-button" title="Переименовать" onClick={() => openDialog("rename-folder", f)}><Pencil size={14}/></button>
          </div>
          {isOpen && <div className="tree-children">{renderTree(f.id)}</div>}
        </div>;
      })}
      {noteList.map((n) => <button draggable onDragStart={(e) => e.dataTransfer.setData("note", String(n.id))} onContextMenu={(e) => openContext(e, { kind: "note", id: n.id })} className={`file-row note-row ${activeNote?.id === n.id ? "active" : ""}`} onClick={() => void openNote(n)} key={`note-${n.id}`}><Files size={15}/><span>{n.title}</span></button>)}
    </>;
  }
  const localPaletteResults = [...folders.map((f) => ({ kind: "folder", id: f.id, title: f.name } as SearchResult)), ...notes.map((n) => ({ kind: "note", id: n.id, title: n.title, snippet: n.content } as SearchResult))]
    .filter((r) => r.title.toLowerCase().includes((palette?.query || "").toLowerCase())).slice(0, 20);
  const globalPaletteResults = palette?.query ? smartResults(palette.query) : paletteResults;

  return <section className="obsidian" onClick={() => { setContextMenu(null); setMenuOpen(false); }}>
    {dialog && <div className="modal-backdrop"><form className="modal" onSubmit={submitDialog}><h2>{dialog.kind === "folder" ? "Новая папка" : "Переименовать"}</h2><input autoFocus value={dialogName} onChange={(e) => setDialogName(e.target.value)} /><div className="toolbar"><button type="submit">Сохранить</button><button type="button" onClick={() => setDialog(null)}>Отмена</button></div></form></div>}
    {palette && <div className="modal-backdrop"><div className="palette"><input autoFocus placeholder={palette.mode === "file" ? "Перейти к файлу или папке" : "Поиск: tag: folder: title: content:"} value={palette.query} onChange={(e) => setPalette({ ...palette, query: e.target.value })}/><div>{(palette.mode === "file" ? localPaletteResults : globalPaletteResults).map((r) => <button key={`${r.kind}-${r.id}`} onClick={() => selectSearchResult(r)}><b>{r.title}</b><span>{r.kind} {r.snippet}</span></button>)}</div></div></div>}
    {moveState && <MoveDialog folders={destinationFolders(moveState.target)} onCancel={() => setMoveState(null)} onMove={(folderId) => void moveToFolder(folderId)} pathFor={folderPathName}/>}
    {trashOpen && <TrashDialog items={trash} onClose={() => setTrashOpen(false)} onEmpty={() => void emptyTrash()} onRestore={(item) => void restoreTrashItem(item)} onDelete={(item) => void deleteTrashItem(item)}/>}
    <input ref={vaultImportRef} hidden type="file" accept=".zip,application/zip" onChange={(e) => e.target.files?.[0] && void importVault(e.target.files[0])}/>
    <input ref={mdImportRef} hidden type="file" accept=".md,text/markdown" onChange={(e) => e.target.files?.[0] && void importMarkdown(e.target.files[0])}/>
    <input ref={imageRef} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => { editorRef.current?.insertImages(Array.from(e.target.files || [])); e.target.value = ""; }}/>
    <aside className="app-rail">
      <button className="rail-button active" title="Файлы"><Files size={19}/></button>
      <button className={`rail-button ${trashOpen ? "active" : ""}`} title="Корзина" onClick={() => void openTrash()}><Trash2 size={18}/></button>
      <div className="rail-menu-wrap"><button className="rail-button" title="Создать" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}><MoreVertical size={19}/></button>
        {menuOpen && <div className="action-menu"><button onClick={() => void createNote(activeFolder)}><FilePlus2 size={16}/>Новая заметка</button><button onClick={() => void openDailyNote()}><Files size={16}/>Daily note</button>{templates.slice(1).map((tpl, i) => <button key={tpl.name} onClick={() => void createFromTemplate(i + 1)}><Files size={16}/>{tpl.name}</button>)}<button onClick={() => openDialog("folder", activeFolder)}><FolderIcon size={16}/>Новая папка</button><button onClick={() => mdImportRef.current?.click()}><Upload size={16}/>Импорт .md</button><button onClick={() => vaultImportRef.current?.click()}><FileArchive size={16}/>Импорт vault</button><button onClick={() => setSettingsOpen(true)}><Settings size={16}/>Настройки</button></div>}
      </div>
      <button className="rail-button rail-bottom" title="Выйти" onClick={onLogout}><LogOut size={18}/></button>
    </aside>
    <nav className={`vault-pane ${dropTarget === 0 ? "drop-target" : ""}`} onContextMenu={(e) => openContext(e, { kind: "root", id: null })} onDrop={(e) => void dropIntoFolder(e, null)} onDragEnter={() => setDropTarget(0)} onDragOver={(e) => e.preventDefault()}>
      <header className="vault-title"><strong>twisted-cloud</strong><span>{account}</span></header>
      <label className="search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" /></label>
      {results.length > 0 && <div className="search-results">{results.map((r) => <button key={`${r.kind}-${r.id}`} onClick={() => selectSearchResult(r)}><b>{r.title}</b><span>{r.kind} {r.snippet}</span></button>)}</div>}
      <div className="pane-toolbar"><button onClick={() => void createNote(activeFolder)}><FilePlus2 size={15}/>Файл</button><button onClick={() => void openDailyNote()}><Files size={15}/>Сегодня</button><button onClick={() => openDialog("folder", activeFolder)}><FolderIcon size={15}/>Папка</button><button title="Экспорт vault" onClick={() => void downloadFromApi("/vault/export.zip", token, "twisted-vault.zip").catch(showError)}><Download size={15}/></button></div>
      <div className="vault-tree">{renderTree(null)}</div>
      {allTags.length > 0 && <div className="tag-panel"><span>Теги</span>{allTags.map((tag) => <button className={activeTag === tag ? "active" : ""} key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}><Tag size={13}/>{tag}</button>)}</div>}
    </nav>
    {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => void createNote(contextMenu.target.kind === "folder" ? contextMenu.target.id : null)}><FilePlus2 size={15}/>Новая заметка</button>
      <button onClick={() => openDialog("folder", contextMenu.target.kind === "folder" ? contextMenu.target.id : null)}><FolderIcon size={15}/>Новая папка</button>
      {contextMenu.target.kind !== "root" && <button onClick={renameSelected}><Pencil size={15}/>Переименовать</button>}
      {isItemRef(contextMenu.target) && <button onClick={() => { const target = contextMenu.target; if (isItemRef(target)) openMoveDialog(target); }}><Move size={15}/>Переместить...</button>}
      {contextMenu.target.kind === "note" && <button onClick={() => downloadText(`${notes.find((n) => n.id === contextMenu.target.id)?.title || "note"}.md`, notes.find((n) => n.id === contextMenu.target.id)?.content || "")}><Download size={15}/>Экспорт</button>}
      {isItemRef(contextMenu.target) && <button onClick={() => { const target = contextMenu.target; if (isItemRef(target)) void deleteItem(target); }}><Trash2 size={15}/>Удалить</button>}
    </div>}
    {settingsOpen && <div className="modal-backdrop"><div className="modal settings-modal"><h2>Настройки</h2><label>Автосохранение, секунд<input type="number" min={15} max={600} value={Math.round(settings.autosaveMs / 1000)} onChange={(e) => updateSettings({ ...settings, autosaveMs: Math.max(15, Number(e.target.value) || 60) * 1000 })}/></label><label>Размер шрифта<input type="number" min={12} max={24} value={settings.fontSize} onChange={(e) => updateSettings({ ...settings, fontSize: Number(e.target.value) || 16 })}/></label><label className="check-row"><input type="checkbox" checked={settings.wideEditor} onChange={(e) => updateSettings({ ...settings, wideEditor: e.target.checked })}/>Широкий редактор</label><div className="toolbar"><button onClick={() => setSettingsOpen(false)}>Закрыть</button></div></div></div>}
    {shareUrl && <div className="modal-backdrop"><div className="modal"><h2>Публичная ссылка</h2><input readOnly value={shareUrl}/><div className="toolbar"><button onClick={() => void navigator.clipboard?.writeText(shareUrl)}>Копировать</button><button onClick={() => setShareUrl("")}>Закрыть</button></div></div></div>}
    <article className="note-pane">
      <header className="tab-bar">{openTabs.map((id) => { const note = notes.find((n) => n.id === id); return note && <div className={`tab ${activeNote?.id === id ? "active" : ""}`} key={id} onClick={() => void openNote(note)}><span>{note.title}</span><button title="Закрыть" onClick={(e) => { e.stopPropagation(); void closeTab(id); }}><X size={13}/></button></div>; })}</header>
      {activeNote ? <div className="note-workspace">
        <div className="note-actions"><input className="title-input" value={activeNote.title} onChange={(e) => setDraft({ title: e.target.value })}/><div className="toolbar"><button title="Редактировать" onClick={() => { setDirty(true); setStatus("Черновик"); }}><Pencil size={16}/></button><button title="Сохранить" onClick={() => void saveNote(activeNote)}><Save size={16}/></button><button title="Split" onClick={() => setSplitView(!splitView)}><Columns2 size={16}/></button><button title="История" onClick={() => setHistoryOpen(!historyOpen)}><History size={16}/></button><button title="Фото" onClick={() => imageRef.current?.click()}><Image size={16}/></button><button title="Экспорт .md" onClick={() => downloadText(`${activeNote.title}.md`, activeNote.content)}><Download size={16}/></button><button title="HTML" onClick={() => exportHtml(activeNote)}>HTML</button><button title="PDF" onClick={() => exportPdf(activeNote)}>PDF</button><button title="Публичная ссылка" onClick={() => void createShare(activeNote)}><Link size={16}/></button><button title="Настройки" onClick={() => setSettingsOpen(true)}><Settings size={16}/></button><button title="Удалить" onClick={() => void deleteItem({ kind: "note", id: activeNote.id })}><Trash2 size={16}/></button><span className={`status ${status.includes("Ошибка") ? "error" : ""}`}>{status}</span></div></div>
        <div className={`workspace-body ${historyOpen ? "with-history" : ""}`}>
          <div className={`editor-shell ${splitView ? "split-view" : ""} ${settings.wideEditor ? "wide" : ""}`} style={{ ["--editor-font-size" as string]: `${settings.fontSize}px` }}>
            <MarkdownCodeEditor
              key={activeNote.id}
              ref={editorRef}
              value={activeNote.content}
              onChange={(content) => setDraft({ content })}
              onUploadImage={uploadImage}
              onUploadError={showImageError}
              onPendingImages={onPendingImages}
              hidden={!dirty && !splitView && pendingImages === 0}
              autoFocus
            />
            {splitView && <div className="rendered-markdown"><MarkdownPreview content={activeNote.content}/></div>}
            {!dirty && !splitView && pendingImages === 0 && <div className="rendered-markdown" onDoubleClick={() => setDirty(true)}><MarkdownPreview content={activeNote.content}/></div>}
          </div>
          {historyOpen && <aside className="history-panel"><h2>История</h2>{versions.map((v) => <button key={v.id} onClick={() => void restoreVersion(v)}><b>{new Date(v.created_at).toLocaleString()}</b><span>{v.title}</span></button>)}</aside>}
        </div>
      </div> : <div className="empty-note"><button onClick={() => void createNote(activeFolder)}>Создать новую заметку</button></div>}
    </article>
  </section>;
}

function MoveDialog({ folders, onCancel, onMove, pathFor }: { folders: Folder[]; onCancel: () => void; onMove: (folderId: number | null) => void; pathFor: (folder: Folder) => string }) {
  return <div className="modal-backdrop">
    <div className="modal move-modal">
      <h2>Переместить</h2>
      <div className="folder-picker">
        <button onClick={() => onMove(null)}><FolderIcon size={15}/>Корень</button>
        {folders.map((folder) => <button key={folder.id} onClick={() => onMove(folder.id)}><FolderIcon size={15}/>{pathFor(folder)}</button>)}
      </div>
      <div className="toolbar"><button onClick={onCancel}>Отмена</button></div>
    </div>
  </div>;
}

function TrashDialog({ items, onClose, onEmpty, onRestore, onDelete }: { items: TrashItem[]; onClose: () => void; onEmpty: () => void; onRestore: (item: TrashItem) => void; onDelete: (item: TrashItem) => void }) {
  return <div className="modal-backdrop">
    <div className="modal trash-modal">
      <header><h2>Корзина</h2><button title="Очистить корзину" onClick={onEmpty}><Eraser size={15}/>Очистить</button></header>
      {items.length === 0 ? <p>Корзина пуста</p> : <div className="trash-list">{items.map((item) => <TrashRow key={`${item.kind}-${item.id}`} item={item} onRestore={onRestore} onDelete={onDelete}/>)}</div>}
      <div className="toolbar"><button onClick={onClose}>Закрыть</button></div>
    </div>
  </div>;
}

function TrashRow({ item, onRestore, onDelete }: { item: TrashItem; onRestore: (item: TrashItem) => void; onDelete: (item: TrashItem) => void }) {
  return <div className="trash-row">
    <div>{item.kind === "folder" ? <FolderIcon size={15}/> : <Files size={15}/>}<span>{item.title}</span></div>
    <small>до {new Date(item.expires_at).toLocaleDateString()}</small>
    <button title="Восстановить" onClick={() => onRestore(item)}><RotateCcw size={15}/></button>
    <button title="Удалить безвозвратно" onClick={() => onDelete(item)}><Trash2 size={15}/></button>
  </div>;
}

function toggleSet(source: Set<number>, id: number) {
  const next = new Set(source);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}

function isItemRef(target: MenuTarget): target is ItemRef {
  return target.kind === "folder" || target.kind === "note";
}

function groupByParent<T extends { id: number; name?: string; title?: string }>(items: T[], key: keyof T) {
  const map = new Map<number | null, T[]>();
  for (const item of items) {
    const parent = item[key] as number | null;
    map.set(parent, [...(map.get(parent) || []), item]);
  }
  for (const list of map.values()) list.sort((a, b) => String(a.name || a.title).localeCompare(String(b.name || b.title)));
  return map;
}

function todayTitle() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadSettings(): SettingsState {
  const defaults = { autosaveMs: 60_000, fontSize: 16, wideEditor: false };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(settingsKey) || "{}") }; } catch { return defaults; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
