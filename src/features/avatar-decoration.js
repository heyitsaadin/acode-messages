// Avatar decorations: a ring or a small accessory drawn around a profile picture.
// The look of each one is CSS (styles.css, ".am-av[data-deco=...]"); the server only stores the name.
// Keep this list in step with DECORATIONS in the server (lib/deco.js).
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
];

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
}
