import React, { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";

type Props = { value: string; onChange: (value: string) => void; autoFocus?: boolean };

const editorTheme = EditorView.theme({
  "&": { caretColor: "#ffffff" },
  ".cm-content": { caretColor: "#ffffff" },
  ".cm-line": { caretColor: "#ffffff" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#ffffff",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#ffffff",
    borderLeftWidth: "2px",
  },
  ".cm-fat-cursor": {
    background: "#ffffff",
    color: "#171717",
  },
});

export default function MarkdownCodeEditor({ value, onChange, autoFocus = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown(),
          EditorView.lineWrapping,
          editorTheme,
          placeholder("Начните писать markdown..."),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (autoFocus) view.focus();
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <div className="code-editor" ref={hostRef} />;
}
