// Emoji for the picker, in categories. Each category is a list of groups: [search words, emoji].
// Searching "heart" finds every emoji in a group whose words contain "heart".
// Only emoji up to Unicode Emoji 12 (2019) are used, with no skin tones or multi-person combos, so they
// also draw on older Android versions instead of showing as empty boxes.

const EMO_KEYCAPS = [..."0123456789#*"].map((c) => `${c}\uFE0F\u20E3`).join(" ");

const EMO_RAW = [
	{
		id: "smileys",
		tab: "😀",
		name: "Smileys & Emotion",
		groups: [
			["smile happy grin laugh joy lol haha funny face", "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇"],
			["love heart eyes kiss crush adore face", "🥰 😍 🤩 😘 😗 😚 😙"],
			["tongue silly playful goofy crazy yum money face", "😋 😛 😜 🤪 😝 🤑 🤗 🤭"],
			["think hmm quiet shh secret zip skeptical neutral smirk eyeroll awkward lie face", "🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥"],
			["tired sleep sleepy sick ill sneeze vomit hot cold dizzy drool mask relieved sad face", "😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯"],
			["cool sunglasses nerd party cowboy monocle face", "🤠 🥳 😎 🤓 🧐"],
			["sad worried cry crying tear scared shock surprised fear anxious pleading sob yawn face", "😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱"],
			["angry mad rage swear evil devil skull poop clown ghost alien robot monster face", "😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 👾 🤖"],
			["cat face smile love kiss shock cry", "😺 😸 😹 😻 😼 😽 🙀 😿 😾"],
			["monkey see hear speak no evil", "🙈 🙉 🙊"],
			["heart love red orange yellow green blue purple black white brown broken", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟"],
			["kiss mark hundred perfect anger boom collision dizzy sweat splash dash speech thought bubble sleep zzz", "💋 💯 💢 💥 💫 💦 💨 💬 💭 💤"],
		],
	},
	{
		id: "people",
		tab: "👋",
		name: "People & Body",
		groups: [
			["hand thumbs up down like dislike ok fist clap wave pray thanks please peace victory rock point fingers cross", "👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🤟 🤘 👌 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 🖕 ✍️ 🤳"],
			["muscle strong arm flex biceps body part", "💪 🦵 🦶 👂 👃 🧠 🦷 🦴 👀 👁️ 👅 👄 👣"],
			["person baby child kid boy girl man woman old adult family", "👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵"],
			["job police detective guard worker king queen prince princess wizard fairy vampire mermaid elf genie zombie superhero villain santa angel pregnant", "👮 🕵️ 💂 👷 🤴 👸 👳 🧙 🧚 🧛 🧜 🧝 🧞 🧟 🦸 🦹 🎅 🤶 👼 🤰"],
			["gesture bow shrug facepalm raise hand no ok pout frown haircut massage walk run dance dancer", "🙇 💁 🙅 🙆 🙋 🤦 🤷 🙎 🙍 💇 💆 🚶 🏃 💃 🕺 👯 🧖 🧗"],
			["footprints family couple kiss love", "💏 💑 👪 👫 👬 👭"],
		],
	},
	{
		id: "animals",
		tab: "🐻",
		name: "Animals & Nature",
		groups: [
			["pet dog cat mouse hamster rabbit bunny animal", "🐶 🐕 🐩 🐱 🐈 🐭 🐁 🐀 🐹 🐰 🐇 🐿️ 🦔"],
			["wild bear panda koala tiger lion fox wolf raccoon animal", "🦊 🐻 🐼 🐨 🐯 🐅 🐆 🦁 🐺 🦝 🦌 🦓 🦍 🦒 🦘"],
			["farm cow pig horse unicorn sheep goat chicken animal", "🐮 🐄 🐂 🐃 🐷 🐖 🐗 🐴 🐎 🦄 🐑 🐏 🐐 🐪 🐫 🦙"],
			["bird chicken penguin duck eagle owl flamingo peacock parrot swan dove animal", "🐔 🐓 🐣 🐤 🐥 🐦 🐧 🕊️ 🦅 🦆 🦢 🦉 🦚 🦜 🦃"],
			["frog monkey gorilla elephant rhino hippo kangaroo animal", "🐸 🐵 🐒 🐘 🦏 🦛"],
			["bug insect bee ant butterfly spider ladybug worm snail scorpion mosquito", "🐝 🐛 🦋 🐌 🐞 🐜 🦗 🕷️ 🕸️ 🦂 🦟"],
			["reptile snake turtle lizard dinosaur dragon t-rex crocodile animal", "🐢 🐍 🦎 🦖 🦕 🐊 🐉 🐲"],
			["sea fish whale dolphin shark octopus squid shrimp crab lobster ocean animal", "🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈"],
			["paw prints bat", "🐾 🦇"],
			["flower rose tulip sunflower blossom plant bouquet", "💐 🌸 💮 🌹 🥀 🌺 🌻 🌼 🌷"],
			["plant tree leaf cactus palm clover mushroom herb nature maple autumn", "🌱 🌲 🌳 🌴 🌵 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 🍄 🌰"],
			["weather sun cloud rain snow storm wind rainbow lightning umbrella fog tornado", "☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 🌪️ 🌫️ 🌈 ☔ ⚡ 💧 🌊"],
			["sky space moon star planet earth globe world night galaxy comet sparkle fire", "🌍 🌎 🌏 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 ⭐ 🌟 ✨ 💫 ☄️ 🌌 🪐 🔥"],
		],
	},
	{
		id: "food",
		tab: "🍔",
		name: "Food & Drink",
		groups: [
			["fruit apple pear orange lemon banana watermelon grapes strawberry melon cherry peach mango pineapple coconut kiwi", "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝"],
			["vegetable tomato avocado eggplant potato carrot corn pepper cucumber broccoli onion garlic peanut", "🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🧅 🧄 🥜"],
			["bread croissant baguette pretzel pancake cheese waffle", "🍞 🥐 🥖 🥨 🥞 🧇 🧀"],
			["meal meat chicken steak bacon burger fries pizza hotdog sandwich taco burrito salad egg pasta noodles soup", "🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥙 🧆 🍳 🥘 🍲 🥣 🥗 🍿 🧂 🥫 🍝 🍜"],
			["asian sushi rice ramen curry dumpling bento fortune cookie takeout", "🍱 🍘 🍙 🍚 🍛 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡"],
			["dessert sweet ice cream donut cookie cake cupcake pie chocolate candy lollipop pudding honey", "🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯"],
			["drink coffee tea milk beer wine cocktail champagne juice soda cup bottle", "☕ 🍵 🧃 🥛 🍼 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 🥤 🧉 🧊"],
			["cutlery fork knife spoon plate chopsticks dining", "🍽️ 🍴 🥄 🔪 🥢"],
		],
	},
	{
		id: "activities",
		tab: "⚽",
		name: "Activities",
		groups: [
			["sport ball soccer football basketball baseball tennis volleyball rugby billiards ping pong badminton hockey cricket golf", "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🥍 🏏 ⛳"],
			["sport boxing martial arts archery fishing skate ski sled", "🏹 🎣 🥊 🥋 🎽 ⛸️ 🥌 🛹 🎿 🛷 🤿"],
			["sport person swim surf bike row climb lift gymnastics wrestle yoga juggle", "🏄 🏊 🚣 🚴 🚵 🏋️ 🤸 🤼 🤽 🤾 🤹 🧘 ⛷️ 🏂 🏌️ 🏇"],
			["game video controller joystick dice puzzle chess dart bowling slot cards", "🎮 🕹️ 🎲 🧩 ♟️ 🎯 🎳 🎰 🎴 🃏 🀄"],
			["art paint theater movie film clapper camera music mic headphones piano drum sax trumpet guitar violin note", "🎨 🎭 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎵 🎶 🎙️"],
			["party celebrate confetti balloon gift present ribbon trophy medal winner first prize ticket award birthday", "🎉 🎊 🎈 🎁 🎀 🏆 🥇 🥈 🥉 🏅 🎖️ 🎫 🎟️ 🎗️ 🎆 🎇 🧨 🎃 🎄 🎋 🎍 🎑"],
		],
	},
	{
		id: "travel",
		tab: "🚗",
		name: "Travel & Places",
		groups: [
			["car vehicle taxi bus police ambulance fire truck tractor motorcycle scooter bike traffic", "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🛺 🚨 🚔 🚍 🚘 🚖"],
			["train tram metro subway rail station cable car", "🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉"],
			["plane airplane flight helicopter rocket ufo satellite ship boat sail anchor fuel road sign", "✈️ 🛫 🛬 🚁 🚀 🛸 🛰️ 🚢 ⛵ 🚤 ⛴️ ⚓ ⛽ 🚧 🚦 🚥 🛶"],
			["building house home office hospital bank hotel school store shop factory castle church mosque temple", "🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 ⛪ 🕌 🕍 ⛩️"],
			["landmark tower statue liberty fountain tent city night sunrise sunset bridge carousel ferris roller coaster", "🗼 🗽 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 🎠 🎡 🎢"],
			["nature place map mountain volcano snow camp beach desert island park", "🗺️ 🗻 🌋 🏔️ ⛰️ 🏕️ 🏖️ 🏜️ 🏝️ 🏞️"],
			["clock time hour watch hourglass timer alarm", "⌛ ⏳ ⌚ ⏰ ⏱️ ⏲️ 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛"],
		],
	},
	{
		id: "objects",
		tab: "💡",
		name: "Objects",
		groups: [
			["phone mobile laptop computer keyboard desktop printer mouse disk camera video tv radio telephone battery plug", "📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🔋 🔌"],
			["light bulb idea flashlight candle lamp", "💡 🔦 🕯️ 🔔 🔕"],
			["tool wrench hammer screw nut gear toolbox magnet bug fix repair settings", "🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧰 🧲 🔗 ⛓️"],
			["science lab test tube dna microscope telescope satellite dish syringe pill medicine", "🧪 🧫 🧬 🔬 🔭 📡 💉 💊"],
			["weapon gun bomb sword shield", "🔫 💣 🛡️ ⚔️ 🗡️"],
			["folder file calendar chart graph clipboard pin paperclip ruler scissors trash lock key", "📁 📂 📅 📆 📈 📉 📊 📋 📌 📍 📎 📏 📐 ✂️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️"],
			["write pen pencil note book notebook read library bookmark news newspaper", "📝 ✏️ 🖊️ 🖋️ 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 📰"],
			["mail email letter envelope package box mailbox inbox briefcase", "📦 📫 📬 📮 ✉️ 📧 📨 📩 💼"],
			["money cash dollar euro yen pound coin bank card credit receipt diamond gem scale", "💰 💴 💵 💶 💷 💸 💳 🧾 💎 ⚖️"],
			["clothes hat crown cap graduation glasses sunglasses shirt tshirt pants scarf gloves coat dress bikini bag backpack shoe heel boot ring lipstick", "👑 👒 🎩 🎓 🧢 👓 🕶️ 👔 👕 👖 🧣 🧤 🧥 👗 👘 👙 👚 👛 👜 👝 🎒 👞 👟 👠 👡 👢 💍 💄"],
			["home bed couch door toilet shower bath soap sponge broom basket paper cleaning", "🛏️ 🛋️ 🚪 🚽 🚿 🛁 🧴 🧷 🧹 🧺 🧻 🧼 🧽"],
			["misc coffin urn crystal ball magic bell cigarette lock", "🔮 🧿 🎁 🧸 🛒 🚬 ⚰️ ⚱️"],
		],
	},
	{
		id: "symbols",
		tab: "🔣",
		name: "Symbols",
		groups: [
			["yes no check cross done correct wrong plus minus divide multiply question exclamation warning stop forbidden prohibited", "✅ ❌ ❎ ✔️ ✖️ ➕ ➖ ➗ ❓ ❔ ❕ ❗ ‼️ ⁉️ ⚠️ 🚫 ⛔ 📵 🔞"],
			["arrow up down left right direction turn back forward refresh loop shuffle repeat", "⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔄 🔃 🔁 🔂 🔀"],
			["media play pause stop record next previous fast forward rewind volume sound music eject", "▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔼 🔽 ◀️ 🔊 🔉 🔈 🔇"],
			["circle square dot color red orange yellow green blue purple black white brown shape diamond triangle", "🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔶 🔷 🔸 🔹 🔺 🔻 🔲 🔳 ⬛ ⬜ 🟥 🟧 🟨 🟩 🟦 🟪 🟫"],
			["number digit keycap one two three four five six seven eight nine zero ten hash star", `${EMO_KEYCAPS} 🔟`],
			["sign button new free cool ok sos up info trademark copyright registered infinity recycle", "🆕 🆓 🆒 🆗 🆙 🆘 🆚 ℹ️ ™️ ©️ ®️ ♻️ ♾️ 🔰 🔱 ✳️ ❇️ 〽️"],
			["card suit spade club heart diamond", "♠️ ♣️ ♥️ ♦️"],
			["flag white black red pirate checkered triangular rainbow", "🏁 🚩 🏳️ 🏴 🎌 🏴‍☠️ 🏳️‍🌈"],
			["religion peace yin yang om star david cross wheel", "☮️ ☯️ ☪️ 🕉️ ✡️ ☸️ ✝️"],
			["zodiac sign aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces", "♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎"],
		],
	},
];

// A few emoji (like ❤ or ☀) are drawn as plain black text unless followed by an invisible "make it an
// emoji" mark (U+FE0F). This adds the mark where it is missing, so the data above can't go wrong.
const EMO_VS16 = "\uFE0F";
let EMO_NEEDS_VS = null;
let EMO_IS_COLOUR = null;
try {
	EMO_NEEDS_VS = new RegExp("^\\p{Emoji}\uFE0F?$", "u");
	EMO_IS_COLOUR = new RegExp("^\\p{Emoji_Presentation}", "u");
} catch {}

function emoFix(e) {
	if (!EMO_NEEDS_VS || !EMO_NEEDS_VS.test(e) || EMO_IS_COLOUR.test(e)) return e;
	return e.replace(EMO_VS16, "") + EMO_VS16;
}

export const EMOJI_CATS = EMO_RAW.map((c) => ({
	...c,
	groups: c.groups.map(([words, list]) => ({ words: `${words} ${c.name.toLowerCase()}`, list: list.split(" ").filter(Boolean).map(emoFix) })),
}));
