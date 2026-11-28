// Checks a decoration picture without decoding it: a PNG, an APNG (animated PNG) or a WebP (still or animated).
// A decoration is drawn around a profile picture, so it must be exactly 288x288 with a see-through background
// (the profile picture circle sits in the middle of it, 240x240).
// The server runs the same checks (lib/decoimg.js in acode-messages-server) because it can't trust the plugin;
// running them here too gives a quick, friendly message before anything is uploaded. Keep the two in step.
// Every file in src/ is bundled into one scope, so the helper names below start with "deco" to stay unique.
export const DECO_LIMITS = { side: 288, bytes: 2_000_000, maxMs: 10000, maxFrames: 100, minName: 2, maxName: 24 };

const decoBe32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const decoBe16 = (b, i) => (b[i] << 8) | b[i + 1];
const decoLe16 = (b, i) => b[i] | (b[i + 1] << 8);
const decoLe24 = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const decoLe32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const decoTag = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

const DECO_PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const DECO_MAX_FRAMES_SEEN = 1000; // stop walking a file that claims far more frames than we would ever accept

// Walks the PNG chunks. Returns { mime, w, h, animated, frames, ms, alpha, outside } or null when this is not a complete PNG.
// "outside" is true when an animation frame reaches past the edge of the picture.
export function pngInfo(b) {
  if (b.length < 45 || DECO_PNG_SIG.some((v, i) => b[i] !== v)) return null;
  let p = 8;
  let w = 0;
  let h = 0;
  let color = 0;
  let trns = false;
  let idat = false;
  let iend = false;
  let animated = false;
  let planned = 0;
  let frames = 0;
  let ms = 0;
  let outside = false;
  while (p + 12 <= b.length) {
    const len = decoBe32(b, p);
    const type = decoTag(b, p + 4);
    const d = p + 8;
    if (len > b.length - d - 4) return null;
    if (p === 8 && (type !== "IHDR" || len !== 13)) return null;
    if (type === "IHDR") {
      w = decoBe32(b, d);
      h = decoBe32(b, d + 4);
      color = b[d + 9];
    } else if (type === "tRNS") {
      trns = true;
    } else if (type === "acTL") {
      if (idat || len !== 8) return null;
      animated = true;
      planned = decoBe32(b, d);
    } else if (type === "fcTL") {
      if (len !== 26) return null;
      const fw = decoBe32(b, d + 4);
      const fh = decoBe32(b, d + 8);
      const fx = decoBe32(b, d + 12);
      const fy = decoBe32(b, d + 16);
      if (!fw || !fh || fx + fw > w || fy + fh > h) outside = true;
      const den = decoBe16(b, d + 22) || 100; // a zero denominator means hundredths
      ms += Math.max(10, (decoBe16(b, d + 20) / den) * 1000); // browsers show a zero delay as about 10 ms
      if (++frames > DECO_MAX_FRAMES_SEEN) return null;
    } else if (type === "IDAT") {
      idat = true;
    } else if (type === "IEND") {
      iend = true;
      p += 12 + len;
      break;
    }
    p += 12 + len;
  }
  if (!iend || !idat || p !== b.length || !w || !h) return null;
  if (animated && (!frames || frames !== planned)) return null;
  const alpha = color === 4 || color === 6 || trns;
  return { mime: "image/png", w, h, animated, frames: animated ? frames : 1, ms: animated ? Math.round(ms) : 0, alpha, outside };
}

// Walks the WebP (RIFF) chunks. Same result shape as pngInfo.
export function webpInfo(b) {
  if (b.length < 30 || decoTag(b, 0) !== "RIFF" || decoTag(b, 8) !== "WEBP" || decoLe32(b, 4) + 8 !== b.length) return null;
  let p = 12;
  let w = 0;
  let h = 0;
  let canvas = false;
  let animated = false;
  let alpha = false;
  let image = false;
  let frames = 0;
  let ms = 0;
  let outside = false;
  while (p + 8 <= b.length) {
    const type = decoTag(b, p);
    const len = decoLe32(b, p + 4);
    const d = p + 8;
    if (len > b.length - d) return null;
    if (type === "VP8X") {
      if (len < 10) return null;
      animated = !!(b[d] & 0x02);
      alpha = !!(b[d] & 0x10);
      w = decoLe24(b, d + 4) + 1;
      h = decoLe24(b, d + 7) + 1;
      canvas = true;
    } else if (type === "ANMF") {
      if (len < 16) return null;
      const fx = decoLe24(b, d) * 2;
      const fy = decoLe24(b, d + 3) * 2;
      const fw = decoLe24(b, d + 6) + 1;
      const fh = decoLe24(b, d + 9) + 1;
      if (fx + fw > w || fy + fh > h) outside = true;
      ms += Math.max(10, decoLe24(b, d + 12));
      if (++frames > DECO_MAX_FRAMES_SEEN) return null;
    } else if (type === "VP8L") {
      if (len < 5 || b[d] !== 0x2f) return null;
      image = true;
      if (!canvas) {
        const v = decoLe32(b, d + 1);
        w = (v & 0x3fff) + 1;
        h = ((v >>> 14) & 0x3fff) + 1;
        alpha = !!((v >>> 28) & 1);
      }
    } else if (type === "VP8 ") {
      if (len < 10 || b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null;
      image = true;
      if (!canvas) {
        w = decoLe16(b, d + 6) & 0x3fff;
        h = decoLe16(b, d + 8) & 0x3fff;
        alpha = false; // plain lossy WebP has no transparency
      }
    }
    p += 8 + len + (len & 1);
  }
  if (!w || !h) return null;
  if (animated ? !frames : !image) return null;
  return { mime: "image/webp", w, h, animated, frames: animated ? frames : 1, ms: animated ? ms : 0, alpha: animated ? true : alpha, outside };
}

// bytes: a Uint8Array. Returns the info, or null when it is neither a PNG nor a WebP.
export const decoInfo = (bytes) => pngInfo(bytes) || webpInfo(bytes);

// Why this picture can't be used as a decoration, or null when it is fine.
export function decoProblem(info, size) {
  const L = DECO_LIMITS;
  if (size > L.bytes) return `That file is too big. A decoration can be at most ${Math.round(L.bytes / 1000)} KB.`;
  if (!info) return "That file could not be read. Use a PNG, an animated PNG (APNG) or a WebP picture.";
  if (info.w !== L.side || info.h !== L.side) return `That picture is ${info.w}x${info.h}. A decoration must be exactly ${L.side}x${L.side}.`;
  if (info.outside) return `A frame of that animation reaches outside the ${L.side}x${L.side} picture.`;
  if (!info.alpha) return "That picture has no see-through background. A decoration needs a transparent one so the profile picture shows through.";
  if (info.animated && info.ms > L.maxMs) return `That animation is too long. It can run for at most ${L.maxMs / 1000} seconds.`;
  if (info.animated && info.frames > L.maxFrames) return `That animation has too many frames (the limit is ${L.maxFrames}).`;
  return null;
}

// A tidy name, or null when it is too short, too long or has odd characters.
export function cleanDecoName(v) {
  const n = String(v ?? "").trim().replace(/\s+/g, " ");
  if (n.length < DECO_LIMITS.minName || n.length > DECO_LIMITS.maxName || /[\u0000-\u001f\u007f<>]/.test(n)) return null;
  return n;
}
