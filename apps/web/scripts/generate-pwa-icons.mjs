/**
 * Generates solid-color placeholder PNGs for PWA / iOS (no npm deps; Node zlib only).
 * Run from repo: `node apps/web/scripts/generate-pwa-icons.mjs`
 * Or from apps/web: `node scripts/generate-pwa-icons.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @param {Buffer} buf */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {string} typeStr @param {Buffer} data */
function pngChunk(typeStr, data) {
  const type = Buffer.from(typeStr, "binary");
  const combined = Buffer.concat([type, data]);
  const crc = crc32(combined);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, type, data, crcBuf]);
}

/** @param {number} w @param {number} h */
function pngIhdr(w, h) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = 8;
  b[9] = 2;
  b[10] = 0;
  b[11] = 0;
  b[12] = 0;
  return pngChunk("IHDR", b);
}

/**
 * @param {number} w
 * @param {number} h
 * @param {readonly [number, number, number]} rgb
 */
function pngIdat(w, h, rgb) {
  const rowSize = 1 + w * 3;
  const raw = Buffer.alloc(rowSize * h);
  const px = Buffer.from(rgb);
  for (let y = 0; y < h; y += 1) {
    const off = y * rowSize;
    raw[off] = 0;
    for (let x = 0; x < w; x += 1) {
      px.copy(raw, off + 1 + x * 3);
    }
  }
  const compressed = zlib.deflateSync(raw);
  return pngChunk("IDAT", compressed);
}

function pngIend() {
  return pngChunk("IEND", Buffer.alloc(0));
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * @param {number} w
 * @param {number} h
 * @param {readonly [number, number, number]} rgb
 */
function encodePng(w, h, rgb) {
  return Buffer.concat([PNG_SIG, pngIhdr(w, h), pngIdat(w, h, rgb), pngIend()]);
}

/** Theme aligned with manifest `theme_color` (#0f172a) */
const THEME_RGB = /** @type {const} */ ([0x0f, 0x17, 0x2a]);

function resolveOutDir() {
  return path.join(__dirname, "..", "public", "icons");
}

function main() {
  const outDir = resolveOutDir();
  fs.mkdirSync(outDir, { recursive: true });

  const files = [
    { name: "icon-192.png", w: 192, h: 192 },
    { name: "icon-512.png", w: 512, h: 512 },
    { name: "apple-touch-icon.png", w: 180, h: 180 },
  ];

  for (const f of files) {
    const buf = encodePng(f.w, f.h, THEME_RGB);
    fs.writeFileSync(path.join(outDir, f.name), buf);
  }

  // eslint-disable-next-line no-console -- CLI script
  console.log(`Wrote ${files.length} PNG(s) to ${outDir}`);
}

main();
