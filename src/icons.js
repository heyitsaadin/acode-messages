// Icons and emoji data.
// Chat bubble with two text lines cut out (monochrome, follows the theme).
export const ICON_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9.5L5 21v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 7.2v1.6h10V7.2H7zm0 4v1.6h6.6v-1.6H7z"/></svg>';
export const ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG)}`;

export const ICONS = {
	back: '<path d="M15 5l-7 7 7 7"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	lock: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
	sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
	close: '<path d="M6 6l12 12M18 6L6 18"/>',
	send: '<path fill="currentColor" stroke="none" d="M3.4 20.4l17.2-7.4a1 1 0 0 0 0-1.9L3.4 3.6a1 1 0 0 0-1.4 1.2l2 6.2 9 1-9 1-2 6.2a1 1 0 0 0 1.4 1.2z"/>',
	smile: '<circle cx="12" cy="12" r="9.5"/><path d="M8 14.2c1 1.5 2.4 2.3 4 2.3s3-.8 4-2.3"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.6"/>',
	hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
	chat: '<path fill="currentColor" stroke="none" d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9.5L5 21v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>',
	users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 13.8c2.6 0 4.5 1.8 4.5 4.5"/>',
	user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
	link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
	edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
	leave: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
	image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
	more: '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>',
	chev: '<path d="M9 6l6 6-6 6"/>',
	shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/>',
	trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
	mute: '<path d="M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	up: '<path d="M6 14l6-6 6 6"/>',
	down: '<path d="M6 10l6 6 6-6"/>',
	globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.8 3 2.8 16 0 19M12 2.5c-2.8 3-2.8 16 0 19"/>',
	mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
	headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8"/>',
	bell: '<path fill="currentColor" stroke="none" d="M12 3a6 6 0 0 0-6 6v4.6l-1.8 2.7A1 1 0 0 0 5 18h14a1 1 0 0 0 .8-1.7L18 13.6V9a6 6 0 0 0-6-6z"/><path fill="currentColor" stroke="none" d="M9.6 19.6h4.8a2.4 2.4 0 0 1-4.8 0z"/>',
	search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
	play: '<path fill="currentColor" stroke="none" d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/>',
	reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>',
	copy: '<rect x="8.5" y="8.5" width="11.5" height="12" rx="2.2"/><path d="M15.5 8.5V5.8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8.7a2 2 0 0 0 2 2h2.5"/>',
	at: '<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/>',
	idcard: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M8 10v4M12 10v4M12 10h2a2 2 0 0 1 0 4h-2"/>',
	pause: '<path fill="currentColor" stroke="none" d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"/>',
};
export const EMOJI = "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😍 😘 😎 🤩 🥳 😏 😌 😴 🤔 🙄 😬 😢 😭 😡 🤯 😱 🥺 👍 👎 👏 🙏 💪 👋 🤝 ✌️ 👀 🔥 ✨ 🎉 💯 ❤️ 💔 💙 💚 🚀 ⭐ ✅ ❌ ⚡ 💡 🐛 🔧 💻 📱 ☕ 🍕 🎮 🎵".split(" ");
