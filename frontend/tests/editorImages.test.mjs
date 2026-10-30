import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { addImageUpload, removeImageUpload, pendingImages, imagePreviews, validateImage } from "../src/editorImages.ts";

const state = (doc = "before after") => EditorState.create({ doc, extensions: [markdown(), pendingImages, imagePreviews] });

test("upload insertion point follows text typed before it", () => {
  let s = state();
  s = s.update({ effects: addImageUpload.of({ id: "image", from: 7, to: 7 }) }).state;
  s = s.update({ changes: { from: 0, insert: "new " } }).state;
  assert.deepEqual(s.field(pendingImages), [{ id: "image", from: 11, to: 11 }]);
});

test("typing at the insertion point is preserved after the image", () => {
  let s = state();
  s = s.update({ effects: addImageUpload.of({ id: "image", from: 7, to: 7 }) }).state;
  s = s.update({ changes: { from: 7, insert: "typed " } }).state;
  assert.equal(s.field(pendingImages)[0].from, 7);
  assert.equal(s.doc.toString(), "before typed after");
});

test("editing the selected replacement range cancels its pending insertion", () => {
  let s = state();
  s = s.update({ effects: addImageUpload.of({ id: "image", from: 0, to: 6 }) }).state;
  s = s.update({ changes: { from: 2, to: 3, insert: "X" } }).state;
  assert.equal(s.field(pendingImages).length, 0);
});

test("deleting the insertion context cancels the upload marker", () => {
  let s = state();
  s = s.update({ effects: addImageUpload.of({ id: "image", from: 7, to: 7 }) }).state;
  s = s.update({ changes: { from: 0, to: s.doc.length } }).state;
  assert.equal(s.field(pendingImages).length, 0);
});

test("removing a failed upload does not change the document or selection", () => {
  let s = state();
  s = s.update({ effects: addImageUpload.of({ id: "image", from: 0, to: 6 }) }).state;
  s = s.update({ effects: removeImageUpload.of("image") }).state;
  assert.equal(s.doc.toString(), "before after");
  assert.equal(s.field(pendingImages).length, 0);
});

test("uploaded images render as widgets, including after reopening", () => {
  const s = state("![Изображение](/media/0123456789abcdef0123456789abcdef.png)");
  assert.equal(s.field(imagePreviews).size, 1);
});

test("code examples and unsafe image URLs are not rendered as image widgets", () => {
  const s = state("```md\n![sample](/media/0123456789abcdef0123456789abcdef.png)\n```\n![bad](javascript:alert)\n![external](https://example.com/image.png)");
  assert.equal(s.field(imagePreviews).size, 0);
});

test("unsupported formats and oversized images fail before upload", () => {
  assert.throws(() => validateImage({ type: "image/svg+xml", size: 1 }), /PNG.*JPEG.*GIF.*WebP/);
  assert.throws(() => validateImage({ type: "image/png", size: 8 * 1024 * 1024 + 1 }), /8 МБ/);
  assert.doesNotThrow(() => validateImage({ type: "image/png", size: 8 * 1024 * 1024 }));
});
