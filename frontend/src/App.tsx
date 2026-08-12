import React, { Suspense, lazy, useEffect, useState } from "react";
import { api } from "./api";
import { initAuth, keycloak, logout, refreshToken } from "./auth";
import type { Folder, Note } from "./types";
import MarkdownPreview from "./MarkdownPreview";

const NotesView = lazy(() => import("./NotesView"));

export default function App() {
  const [token, setToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [publicNote, setPublicNote] = useState<{ title: string; content: string } | null>(null);

  const load = async () => {
    if (!token) return;
    const nextToken = await refreshToken();
    setToken(nextToken);
    const [nextFolders, nextNotes] = await Promise.all([
      api<Folder[]>("/folders", nextToken),
      api<Note[]>("/notes", nextToken),
    ]);
    setFolders(nextFolders);
    setNotes(nextNotes);
  };

  useEffect(() => {
    const shareToken = /^\/share\/([^/]+)/.exec(window.location.pathname)?.[1];
    if (shareToken) {
      void fetch(`/api/public/shares/${shareToken}`).then((res) => {
        if (!res.ok) throw new Error("Share not found");
        return res.json();
      }).then(setPublicNote).catch((error: Error) => setAuthError(error.message));
      return;
    }
    let active = true;
    void initAuth().then((nextToken) => active && setToken(nextToken)).catch((error: Error) => setAuthError(error.message));
    const interval = window.setInterval(() => {
      void refreshToken().then((nextToken) => active && setToken(nextToken)).catch(() => logout());
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => { void load(); }, [token]);

  if (window.location.pathname.startsWith("/share/")) {
    return <main className="public-share">{publicNote ? <article><h1>{publicNote.title}</h1><MarkdownPreview content={publicNote.content}/></article> : <p>{authError || "Загрузка..."}</p>}</main>;
  }

  if (!token) {
    return <main className="login"><section><h1>Twisted Vault</h1><p>{authError || "Переход к авторизации..."}</p></section></main>;
  }

  return <main className="shell">
    <Suspense fallback={<section className="loading">Загрузка...</section>}>
      <NotesView
        token={token}
        folders={folders}
        notes={notes}
        setFolders={setFolders}
        setNotes={setNotes}
        reload={load}
        account={keycloak.tokenParsed?.email || keycloak.tokenParsed?.preferred_username || "Vault"}
        onLogout={logout}
      />
    </Suspense>
  </main>;
}
