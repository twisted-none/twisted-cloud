import React, { useEffect, useRef } from "react";

type Props = { value: string; noteId?: number | string | null; onChange: (value: string) => void };
type Parsed = { tag: string; text: string; prefix?: string; raw?: string; src?: string; alt?: string };

const parseLine = (line: string): Parsed => {
  const heading = /^(#{1,6})\s(.*)$/.exec(line);
  const ordered = /^(\d+\.)\s(.*)$/.exec(line);
  const bullet = /^[-*]\s(.*)$/.exec(line);
  const quote = /^>\s?(.*)$/.exec(line);
  const image = /^!\[(.*?)]\((.*?)\)$/.exec(line);
  if (image) return { tag: "figure", text: image[1], raw: line, src: image[2], alt: image[1] };
  if (heading) return { tag: `h${heading[1].length}`, text: heading[2], prefix: `${heading[1]} ` };
  if (ordered) return { tag: "div", text: ordered[2], prefix: `${ordered[1]} ` };
  if (bullet) return { tag: "div", text: bullet[1], prefix: "- " };
  if (quote) return { tag: "blockquote", text: quote[1], prefix: "> " };
  return { tag: "p", text: line };
};

const createBlock = (line: string) => {
  const parsed = parseLine(line);
  const el = document.createElement(parsed.tag);
  el.className = parsed.prefix === "- " ? "md-block md-bullet" : "md-block";
  if (parsed.prefix) el.dataset.mdPrefix = parsed.prefix;
  if (parsed.raw) el.dataset.mdRaw = parsed.raw;
  if (parsed.src) {
    el.contentEditable = "false";
    const img = document.createElement("img");
    img.src = parsed.src;
    img.alt = parsed.alt || "";
    el.append(img);
  } else {
    el.textContent = parsed.text || "\u200b";
  }
  return el;
};

const serialize = (root: HTMLDivElement) => Array.from(root.children).map((child) => {
  const el = child as HTMLElement;
  if (el.dataset.mdRaw) return el.dataset.mdRaw;
  const text = (el.textContent || "").replace(/\u200b/g, "").replace(/\u00a0/g, " ");
  if (el.dataset.mdPrefix) return `${el.dataset.mdPrefix}${text}`;
  return text;
}).join("\n");

export default function MarkdownEditor({ value, noteId, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const lines = value.length ? value.split("\n") : [""];
    root.replaceChildren(...lines.map(createBlock));
  }, [noteId]);

  const normalizeActiveBlock = () => {
    const selection = window.getSelection();
    const root = ref.current;
    if (!selection?.anchorNode || !root) return;
    const block = (selection.anchorNode.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode as HTMLElement)?.closest(".md-block");
    if (!block || !root.contains(block) || (block as HTMLElement).dataset.mdRaw) return;
    const raw = (block.textContent || "").replace(/\u200b/g, "");
    const next = createBlock(raw);
    if (next.tagName === block.tagName && next.getAttribute("data-md-prefix") === (block as HTMLElement).dataset.mdPrefix) return;
    block.replaceWith(next);
    const range = document.createRange();
    range.selectNodeContents(next);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  return <div
    ref={ref}
    className="markdown-editor"
    contentEditable
    spellCheck
    onInput={() => { normalizeActiveBlock(); if (ref.current) onChange(serialize(ref.current)); }}
    onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }}
  />;
}
