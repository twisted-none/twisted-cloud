import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Annotation, EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { imagePreviews, imageUploadPlugin, pendingImages, type UploadImage } from "./editorImages";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: UploadImage;
  onUploadError: (error: unknown) => void;
  onPendingImages: (delta: number) => void;
  autoFocus?: boolean;
  hidden?: boolean;
};
export type MarkdownCodeEditorHandle = { insertImages: (files: File[]) => void };
const externalValue = Annotation.define<boolean>();

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

export default forwardRef<MarkdownCodeEditorHandle, Props>(function MarkdownCodeEditor(props, ref) {
  const { value, autoFocus = false, hidden = false } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const insertImages = useRef<(files: File[]) => void>(() => {});

  useImperativeHandle(ref, () => ({ insertImages: (files) => insertImages.current(files) }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    const uploads = imageUploadPlugin(
      (file, signal) => callbacks.current.onUploadImage(file, signal),
      (error) => callbacks.current.onUploadError(error),
      (delta) => callbacks.current.onPendingImages(delta),
    );
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown(),
          pendingImages,
          imagePreviews,
          uploads,
          EditorView.lineWrapping,
          editorTheme,
          placeholder("Начните писать markdown..."),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(externalValue))) {
              callbacks.current.onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    insertImages.current = (files) => { void view.plugin(uploads)?.insert(files); };
    if (autoFocus && !hidden) view.focus();
    return () => { insertImages.current = () => {}; view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: [externalValue.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    if (!hidden) {
      viewRef.current?.requestMeasure();
      if (autoFocus) viewRef.current?.focus();
    }
  }, [hidden, autoFocus]);

  return <div className="code-editor" ref={hostRef} hidden={hidden} />;
});
