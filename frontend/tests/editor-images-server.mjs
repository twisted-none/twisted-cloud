import { createServer } from "vite";
import { deflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(data.length + 8);
  result.writeUInt32BE(bytes.length);
  data.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(480); header.writeUInt32BE(240, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc(240 * (480 * 3 + 1));
for (let y = 0; y < 240; y++) for (let x = 0; x < 480; x++) {
  const offset = y * (480 * 3 + 1) + 1 + x * 3;
  pixels.set(y < 40 ? [48, 51, 58] : (x > 24 && x < 456 && y > 64 && y < 200 ? [84, 123, 166] : [225, 231, 239]), offset);
}
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
const server = await createServer({
  configLoader: "runner",
  cacheDir: join(tmpdir(), "twisted-cloud-editor-images-vite"),
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
  plugins: [{ name: "local-image-fixture", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/media/0123456789abcdef0123456789abcdef.png") return next();
      res.setHeader("Content-Type", "image/png"); res.end(png);
    });
  } }],
});
await server.listen();
console.log("Local fixture: http://127.0.0.1:5178/tests/editor-images.html (no real backend)");
