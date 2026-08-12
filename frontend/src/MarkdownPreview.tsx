import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

function MermaidBlock({ chart }: { chart: string }) {
  const [srcDoc, setSrcDoc] = useState("");
  useEffect(() => {
    let cancelled = false;
    const id = `m-${crypto.randomUUID()}`;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      const api = mermaid as unknown as { render: (...args: unknown[]) => Promise<{ svg: string }> | string };
      const result = await api.render(id, chart);
      const svg = typeof result === "string" ? result : result.svg;
      if (!cancelled) setSrcDoc(mermaidDocument(svg));
    }).catch(() => { if (!cancelled) setSrcDoc(`<pre>${escapeHtml(chart)}</pre>`); });
    return () => { cancelled = true; };
  }, [chart]);
  return <iframe className="mermaid-frame" sandbox="" title="Mermaid diagram" srcDoc={srcDoc || "<p>Rendering...</p>"} />;
}

export default function MarkdownPreview({ content }: { content: string }) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      code(props) {
        const language = /language-(\w+)/.exec(props.className || "")?.[1];
        if (language === "mermaid") return <MermaidBlock chart={String(props.children)} />;
        return <code className={props.className}>{props.children}</code>;
      },
    }}
  >{content}</ReactMarkdown>;
}

function mermaidDocument(svg: string) {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{margin:0;padding:12px;background:#1e1e1e;color:#eeeeee;font:14px system-ui}svg{max-width:100%;height:auto}</style>${svg}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
