// Avatar decorations: animated rings and accessories drawn around profile pictures.
// The look of each one is CSS (avatar-decorations.css); the server only stores the name.
// Keep this list in step with DECORATIONS in the server (lib/deco.js).
// This file also holds the GIF picking helpers used by Edit profile.
import { GIF_LIMITS, gifInfo, gifProblem, isGifBytes } from "../gif.js";

export const DECORATIONS = [
	{ id: "neon", name: "Neon" },
	{ id: "gold", name: "Gold" },
	{ id: "rainbow", name: "Rainbow" },
	{ id: "fire", name: "Fire" },
	{ id: "frost", name: "Frost" },
	{ id: "halo", name: "Halo" },
	{ id: "crown", name: "Crown" },
	{ id: "ears", name: "Cat ears" },
	{ id: "horns", name: "Horns" },
	{ id: "aurora", name: "Aurora" },
	{ id: "galaxy", name: "Galaxy" },
	{ id: "electric", name: "Electric" },
	{ id: "sakura", name: "Sakura" },
	{ id: "ember", name: "Ember" },
];

const readBytes = (file) =>
	new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(new Uint8Array(r.result));
		r.onerror = () => reject(new Error("Could not read that file"));
		r.readAsArrayBuffer(file);
	});

export class AvatarDecorationMethods {
	/* ---------- avatar decorations ---------- */

	// The tiles of the picker in Edit profile: "None" first, then every decoration drawn on the person's own picture.
	// user: { name, avatar_url }, current: the chosen id or null, onPick(id|null) is called when one is tapped.
	decoTiles(user, current, onPick) {
		const tile = (id, name) =>
			this.el(
				"button",
				{ class: `am-deco-t${(current || null) === id ? " on" : ""}`, type: "button", onclick: () => onPick(id) },
				this.avatar({ ...user, avatar_decoration: id }, 44),
				this.el("span", { text: name }),
			);
		return [tile(null, "None"), ...DECORATIONS.map((d) => tile(d.id, d.name))];
	}

	/* ---------- GIF pictures ---------- */

	async looksLikeGif(file) {
		if (file.type === "image/gif") return true;
		if (file.type && file.type !== "application/octet-stream") return false;
		try {
			return isGifBytes(await readBytes(file.slice(0, 6)));
		} catch {
			return false;
		}
	}

	async prepGif(file, kind) {
		const tooBig = gifProblem(null, file.size, kind);
		if (file.size > GIF_LIMITS[kind].bytes) throw new Error(tooBig);
		const b = await readBytes(file);
		const why = gifProblem(gifInfo(b), file.size, kind);
		if (why) throw new Error(why);
		let s = "";
		for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
		return `data:image/gif;base64,${btoa(s)}`;
	}
}
