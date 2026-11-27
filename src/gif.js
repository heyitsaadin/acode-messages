// Reads a GIF's size, number of frames and running time without decoding any pixels,
// so a GIF that is too big or too long can be turned away before it is uploaded.
// The server checks the same limits (acode-messages-server/lib/gif.js), so keep the two in step.
export const GIF_LIMITS = {
	avatar: { bytes: 300000, side: 512, label: "profile picture" },
	banner: { bytes: 800000, side: 1280, label: "banner" },
	maxMs: 8000, // one run through, in milliseconds
	maxFrames: 200,
};

export const isGifBytes = (b) => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;

// Returns { w, h, frames, ms }, or null if the bytes are not a complete GIF.
export function gifInfo(b) {
	if (!isGifBytes(b) || b.length < 14) return null;
	const u16 = (i) => b[i] | (b[i + 1] << 8);
	const w = u16(6);
	const h = u16(8);
	let p = 13;
	if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1)); // global colour table
	let frames = 0;
	let cs = 0; // running time in hundredths of a second
	let delay = 0;
	const skip = () => {
		while (p < b.length && b[p] !== 0) p += b[p] + 1;
		p++;
	};
	while (p < b.length) {
		const t = b[p++];
		if (t === 0x3b) return { w, h, frames, ms: cs * 10 }; // trailer: the end of the file
		if (t === 0x21) {
			const label = b[p++];
			if (label === 0xf9 && b[p] === 4) delay = u16(p + 2); // graphic control: how long the next frame shows
			skip();
		} else if (t === 0x2c) {
			p += 8; // left, top, width, height
			const f = b[p++];
			if (f & 0x80) p += 3 * (1 << ((f & 7) + 1)); // local colour table
			p++; // LZW minimum code size
			skip();
			frames++;
			cs += delay <= 1 ? 10 : delay; // browsers play a delay of 0 or 1 as 10, so count it that way
			delay = 0;
		} else return null;
	}
	return null; // no trailer: cut off
}

// Why this GIF can't be used, or null when it is fine. kind is "avatar" or "banner".
// info may be null (not read yet): the size check still works, so a huge file is refused before it is read.
export function gifProblem(info, size, kind) {
	const lim = GIF_LIMITS[kind];
	if (size > lim.bytes) return `That GIF is ${Math.round(size / 1000)} KB. A ${lim.label} GIF can be at most ${Math.round(lim.bytes / 1000)} KB. Shrink or trim it and try again.`;
	if (!info) return "That GIF could not be read. Try another one.";
	if (info.w > lim.side || info.h > lim.side) return `That GIF is ${info.w}×${info.h}. The largest allowed is ${lim.side}×${lim.side}.`;
	if (info.ms > GIF_LIMITS.maxMs) return `That GIF runs for ${(info.ms / 1000).toFixed(1)} seconds. The limit is ${GIF_LIMITS.maxMs / 1000} seconds.`;
	if (info.frames > GIF_LIMITS.maxFrames) return `That GIF has ${info.frames} frames. The limit is ${GIF_LIMITS.maxFrames}.`;
	return null;
}
