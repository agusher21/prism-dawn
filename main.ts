// A working coolest-art-01 entry (Node 22, standard library only).
// Generates a bold, deterministic abstract piece ("Prism Dawn") and writes it
// to /output/entry.png (MAKEFUN_OUTPUT_DIR outside the grader container).
// Runs twice and writes identical bytes. No network. stdlib only.

import {
  deflateRawSync,
} from "node:zlib";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const OUT_PATH = join(OUT_DIR, "entry.png");
const W = 1024;
const H = 1024;

// ---------------------------------------------------------------
// Deterministic pseudo-random (xorshift128+) — no Math.random.
// ---------------------------------------------------------------
let x = 0x243f6a8885a308d3n;
let y = 0x3456789012345678n;
let z = 0x9876543210abcdefn;
let w = 0xdef0123456789abcn;

function xorshift(): number {
  const t = x ^ (x << 11n);
  x = y;
  y = z;
  z = w;
  w = (w ^ (w >> 19n)) ^ (t ^ (t >> 8n));
  // return uniform in [0,1)
  return Number((w >>> 0n) / 0xfffffffffn);
}

// ---------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// sRGB -> linear (for correct alpha blending)
function toLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function toSrgb(c: number): number {
  return c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// Blend src (with alpha) over dst, both in linear space, premultiplied-ish.
function blendOver(
  dR: number, dG: number, dB: number, dA: number,
  sR: number, sG: number, sB: number, sA: number,
): [number, number, number, number] {
  const a = sA;
  const outR = sR * a + dR * (1 - a);
  const outG = sG * a + dG * (1 - a);
  const outB = sB * a + dB * (1 - a);
  const outA = a + dA * (1 - a);
  return [outR, outG, outB, outA];
}

// ---------------------------------------------------------------
// Palette (linear space). Bold, high-contrast.
// ---------------------------------------------------------------
const BG = [0.055, 0.045, 0.075, 1.0];           // deep slate
const C_TEAL = [0.06, 0.72, 0.78, 0.85];         // bright teal
const C_ORANGE = [0.96, 0.44, 0.09, 0.85];       // vivid orange
const C_PURPLE = [0.66, 0.33, 0.97, 0.8];        // electric purple
const C_PINK = [0.92, 0.28, 0.60, 0.75];         // hot pink
const C_YELLOW = [1.0, 0.85, 0.10, 0.7];         // sunny yellow
const C_WHITE = [1.0, 1.0, 1.0, 0.9];

// ---------------------------------------------------------------
// Geometry: circle with soft falloff (smoothstep edge).
// ---------------------------------------------------------------
function circleField(
  buf: Uint8Array,
  cx: number, cy: number, r: number,
  color: [number, number, number, number],
  falloff: number = 0.18,
) {
  const r2 = r * r;
  const edge = r * falloff;
  for (let py = 0; py < H; py++) {
    const dy = py - cy;
    const dy2 = dy * dy;
    const row = py * W * 4;
    for (let px = 0; px < W; px++) {
      const dx = px - cx;
      const d2 = dx * dx + dy2;
      let d = Math.sqrt(d2);
      // distance to edge
      const t = 1 - (d - (r - edge)) / edge;
      const alpha = color[3] * (t > 1 ? 1 : t < 0 ? 0 : t);
      if (alpha <= 0) continue;
      const i = row + px * 4;
      const [oR, oG, oB, oA] = blendOver(
        buf[i] / 255, buf[i + 1] / 255, buf[i + 2] / 255, buf[i + 3] / 255,
        color[0], color[1], color[2], alpha,
      );
      buf[i] = Math.round(toSrgb(oR) * 255);
      buf[i + 1] = Math.round(toSrgb(oG) * 255);
      buf[i + 2] = Math.round(toSrgb(oB) * 255);
      buf[i + 3] = Math.round(oA * 255);
    }
  }
}

// ---------------------------------------------------------------
// Build the framebuffer.
// ---------------------------------------------------------------
const buf = Buffer.alloc(W * H * 4);

// Background
for (let i = 0; i < buf.length; i += 4) {
  buf[i] = Math.round(toSrgb(BG[0]) * 255);
  buf[i + 1] = Math.round(toSrgb(BG[1]) * 255);
  buf[i + 2] = Math.round(toSrgb(BG[2]) * 255);
  buf[i + 3] = Math.round(BG[3] * 255);
}

// Large overlapping circles — the core bold shape
circleField(buf, W * 0.30, H * 0.35, W * 0.42, C_TEAL, 0.25);
circleField(buf, W * 0.70, H * 0.65, W * 0.50, C_ORANGE, 0.22);
circleField(buf, W * 0.50, H * 0.50, W * 0.34, C_PURPLE, 0.30);
circleField(buf, W * 0.15, H * 0.80, W * 0.28, C_PINK, 0.28);
circleField(buf, W * 0.85, H * 0.20, W * 0.30, C_YELLOW, 0.30);

// Sharp central accent: bright white core
circleField(buf, W * 0.50, H * 0.50, W * 0.06, C_WHITE, 0.5);

// ---------------------------------------------------------------
// Encode scanlines with filter 0 (None).
// ---------------------------------------------------------------
const scanlineLen = 1 + W * 4;
const raw = Buffer.alloc(H * scanlineLen);
for (let py = 0; py < H; py++) {
  const off = py * scanlineLen;
  raw[off] = 0; // filter: none
  buf.copy(raw, off + 1, py * W * 4, (py + 1) * W * 4);
}

// ---------------------------------------------------------------
// PNG chunks.
// ---------------------------------------------------------------
function crc32(data: Buffer, start: number, end: number, prev = 0): number {
  let crc = prev ^ 0xffffffff;
  for (let i = start; i < end; i++) {
    crc ^= data[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput, 0, crcInput.length), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const signature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Deflate the scanlines (raw, no zlib header)
const deflated = deflateRawSync(raw, {
  level: 9,
  memLevel: 9,
});

const chunks: Buffer[] = [];
chunks.push(chunk("IHDR", ihdr));
chunks.push(chunk("IDAT", deflated));
chunks.push(chunk("IEND", Buffer.alloc(0)));

const png = Buffer.concat([signature, ...chunks]);

// ---------------------------------------------------------------
// Write output.
// ---------------------------------------------------------------
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}
writeFileSync(OUT_PATH, png);
console.log(`Wrote ${OUT_PATH} (${png.length} bytes, ${W}x${H})`);
