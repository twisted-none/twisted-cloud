import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import NotesView from "../src/NotesView";
import type { Note } from "../src/types";
import "../src/styles.css";

const imageUrl = "/media/0123456789abcdef0123456789abcdef.png";
const nativeFetch = window.fetch.bind(window);
let delay = 0;
let saveDelay = 0;
let fail = false;
let requestLog: number[] = [];
let reportRequests = () => {};
const initialNotes: Note[] = [910001, 910002].map((id, index) => ({
  id, title: `Тестовая заметка ${index + 1}`, content: "# Заметка\n\nТекст до вставки.\n\nТекст после вставки.",
  folder_id: null, owner_id: 1, updated_at: "2026-10-22T00:00:00Z",
}));

window.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("/api/media?")) {
    requestLog.push(Number(new URL(url, location.origin).searchParams.get("note_id")));
    reportRequests();
    const shouldFail = fail;
    fail = false;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, delay);
      init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
    return shouldFail ? Response.json({ detail: "Тестовая ошибка сервера" }, { status: 500 })
      : Response.json({ url: imageUrl, original_name: "screenshot.png" });
  }
  if (url.startsWith("/api/notes/") && init?.method === "PUT") {
    await new Promise((resolve) => setTimeout(resolve, saveDelay));
    return Response.json(JSON.parse(String(init.body)));
  }
  if (url.startsWith("/api/")) return Response.json([]);
  return nativeFetch(input, init);
};

function TestApp() {
  const [notes, setNotes] = useState(initialNotes);
  const [log, setLog] = useState("");
  reportRequests = () => setLog(requestLog.join(", "));
  async function pasteImage() {
    const blob = await (await nativeFetch(imageUrl)).blob();
    const data = new DataTransfer();
    data.items.add(new File([blob], "screenshot.png", { type: "image/png" }));
    document.querySelector(".cm-content")?.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  }
  return <>
    <div style={{ padding: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button onClick={() => void pasteImage()}>Вставить тестовый скриншот</button>
      <label>Задержка загрузки <select onChange={(event) => { delay = Number(event.target.value); }}><option value="0">Нет</option><option value="3000">3 секунды</option><option value="15000">15 секунд</option></select></label>
      <label>Задержка сохранения <select onChange={(event) => { saveDelay = Number(event.target.value); }}><option value="0">Нет</option><option value="3000">3 секунды</option></select></label>
      <button onClick={() => { fail = true; }}>Ошибка следующей загрузки</button>
      <span>Запросы к заметкам: {log || "нет"}</span>
    </div>
    <NotesView token="fake-test-token" folders={[]} notes={notes} setFolders={() => {}} setNotes={setNotes} reload={async () => {}} account="Локальный тест" onLogout={() => {}} />
    <pre aria-label="Сохранённые заметки">{notes.map((note) => `${note.title}\n${note.content}`).join("\n---\n")}</pre>
  </>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<TestApp />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
