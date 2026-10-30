import { MapMode, StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";

type PendingImage = { id: string; from: number; to: number };
export type UploadImage = (file: File, signal: AbortSignal) => Promise<string>;

export function validateImage(file: Pick<File, "type" | "size">): void {
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
    throw new Error("Поддерживаются изображения PNG, JPEG, GIF и WebP");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Изображение должно быть не больше 8 МБ");
}

class UploadWidget extends WidgetType {
  toDOM() {
    const label = document.createElement("span");
    label.className = "cm-image-upload";
    label.setAttribute("role", "status");
    label.textContent = "Загрузка изображения…";
    return label;
  }
}

export const addImageUpload = StateEffect.define<PendingImage>();
export const removeImageUpload = StateEffect.define<string>();

// Track the paste location through edits, without putting temporary URLs in drafts.
export const pendingImages = StateField.define<readonly PendingImage[]>({
  create: () => [],
  update(value, transaction) {
    const next: PendingImage[] = [];
    for (const pending of value) {
      if (pending.from !== pending.to && transaction.changes.touchesRange(pending.from, pending.to)) continue;
      const from = transaction.changes.mapPos(pending.from, -1, MapMode.TrackDel);
      const to = pending.from === pending.to ? from : transaction.changes.mapPos(pending.to, 1, MapMode.TrackDel);
      if (from !== null && to !== null) next.push({ ...pending, from, to });
    }
    for (const effect of transaction.effects) {
      if (effect.is(addImageUpload)) next.push(effect.value);
      if (effect.is(removeImageUpload)) {
        const index = next.findIndex((pending) => pending.id === effect.value);
        if (index !== -1) next.splice(index, 1);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => Decoration.set(value.map((pending) =>
    Decoration.widget({ widget: new UploadWidget(), side: -1 }).range(pending.from)), true)),
});

class ImageWidget extends WidgetType {
  readonly src: string;
  readonly alt: string;

  constructor(src: string, alt: string) {
    super();
    this.src = src;
    this.alt = alt;
  }

  eq(other: ImageWidget) { return this.src === other.src && this.alt === other.alt; }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-note-image";
    const image = document.createElement("img");
    image.alt = this.alt;
    image.onload = () => view.requestMeasure();
    image.onerror = () => {
      wrapper.textContent = "Не удалось загрузить изображение";
      view.requestMeasure();
    };
    image.src = this.src;
    wrapper.append(image);
    return wrapper;
  }
}

function decorateImages(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Image") return;
      const url = node.node.getChild("URL");
      if (!url) return;
      const src = state.doc.sliceString(url.from, url.to);
      // Preview only uploaded local assets; leave arbitrary links and code as text.
      if (!/^\/media\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(src)) return;
      const raw = state.doc.sliceString(node.from, node.to);
      const alt = /^!\[(.*?)\]/.exec(raw)?.[1] || "Изображение";
      ranges.push(Decoration.replace({ widget: new ImageWidget(src, alt) }).range(node.from, node.to));
    },
  });
  return Decoration.set(ranges, true);
}

export const imagePreviews = StateField.define<DecorationSet>({
  create: decorateImages,
  update: (value, transaction) => transaction.docChanged || syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
    ? decorateImages(transaction.state) : value,
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

export function imageUploadPlugin(upload: UploadImage, onError: (error: unknown) => void, onPending: (delta: number) => void) {
  return ViewPlugin.fromClass(class {
    readonly view: EditorView;
    readonly controllers = new Set<AbortController>();
    destroyed = false;

    constructor(view: EditorView) { this.view = view; }

    async insert(files: File[]) {
      try { files.forEach(validateImage); } catch (error) { onError(error); return; }
      if (!files.length) return;
      const id = crypto.randomUUID();
      const controller = new AbortController();
      this.controllers.add(controller);
      const { from, to } = this.view.state.selection.main;
      this.view.dispatch({ effects: addImageUpload.of({ id, from, to }) });
      onPending(1);
      try {
        const urls = await Promise.all(files.map((file) => upload(file, controller.signal)));
        if (this.destroyed) return;
        const target = this.view.state.field(pendingImages).find((pending) => pending.id === id);
        if (!target) return;
        const before = target.from > 0 && this.view.state.doc.sliceString(target.from - 1, target.from) !== "\n" ? "\n" : "";
        const after = this.view.state.doc.sliceString(target.to, target.to + 1) === "\n" ? "" : "\n";
        const insert = before + urls.map((url) => `![Изображение](${url})`).join("\n") + after;
        this.view.dispatch({
          changes: { from: target.from, to: target.to, insert },
          effects: removeImageUpload.of(id),
          userEvent: "input.paste",
        });
      } catch (error) {
        controller.abort();
        if (!this.destroyed) onError(error);
      } finally {
        if (!this.destroyed) {
          this.view.dispatch({ effects: removeImageUpload.of(id) });
          this.controllers.delete(controller);
          onPending(-1);
        }
      }
    }

    destroy() {
      this.destroyed = true;
      this.controllers.forEach((controller) => controller.abort());
      if (this.controllers.size) onPending(-this.controllers.size);
    }
  }, {
    eventHandlers: {
      paste(event) {
        const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void this.insert(files);
        return true;
      },
    },
  });
}
