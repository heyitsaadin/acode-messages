// Syntax highlighting for code cards.
// A small tokenizer splits code into comments, strings, numbers, keywords and so on, and wraps each piece in
// <span class="hl-x">. The result is built from DOM nodes (never innerHTML), so shared code can't inject markup.
// Classes: c comment, s string, n number / literal, k keyword, f function call, t type name, p property, m meta.

const set = (s) => new Set(s.split(" "));
const NONE = new Set();

const JS_KW = set("async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch this throw try typeof var void while with yield interface enum implements namespace declare abstract readonly private public protected keyof");
const JS_LIT = set("true false null undefined NaN Infinity");
const PY_KW = set("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield");
const PY_LIT = set("True False None self cls");
const C_KW = set("abstract as auto bool boolean break byte case catch char class const continue default defer delete do double else enum explicit export extends extern final finally float for fn fun func function goto if impl implements import in inline instanceof int interface internal is let long match mod mut namespace new object operator override package private protected pub public readonly ref return sealed short signed sizeof static str string struct super switch synchronized template this throw throws trait try typedef typename union unsigned use using val var virtual void volatile where while yield");
const C_LIT = set("true false null nil");
const SH_KW = set("if then else elif fi for while until do done case esac in function select return exit break continue local export readonly unset source alias echo cd set shift trap");
const SQL_KW = set("select from where and or not null insert into values update set delete create table alter drop index view join left right inner outer full cross on as group by order having limit offset union all distinct case when then else end is in like between exists primary key foreign references default unique check constraint begin commit rollback grant to with returning asc desc count sum avg min max");

// Pieces of regex source. None of them may contain a capturing group: build() wraps each in one.
const SLASH = String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`;
const HASH = String.raw`#[^\n]*`;
const DASH = String.raw`--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`;
const Q2 = String.raw`"(?:\\[\s\S]|[^"\\\n])*"?`;
const Q1 = String.raw`'(?:\\[\s\S]|[^'\\\n])*'?`;
const BT = "`(?:\\\\[\\s\\S]|[^`\\\\])*`?";
const PY3 = String.raw`"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)`;
const SQLQ = String.raw`'(?:''|[^'])*'?|"[^"\n]*"?`;
const NUM = String.raw`\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b`;
const WORD = String.raw`[A-Za-z_$][\w$]*`;
const CSS_NUM = String.raw`#[\da-fA-F]{3,8}\b|-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]{1,4})?`;

const FAMILIES = {
	js: { kw: JS_KW, lit: JS_LIT, com: SLASH, str: [Q2, Q1, BT].join("|"), type: true },
	py: { kw: PY_KW, lit: PY_LIT, com: HASH, str: [PY3, Q2, Q1].join("|"), meta: String.raw`@[\w.]+`, type: true },
	c: { kw: C_KW, lit: C_LIT, com: SLASH, str: [Q2, Q1].join("|"), meta: String.raw`@\w+`, type: true },
	sh: { kw: SH_KW, lit: NONE, com: HASH, str: [Q2, Q1].join("|"), meta: String.raw`\$(?:\{[^}\n]*\}|\w+)` },
	json: { kw: NONE, lit: set("true false null"), com: SLASH, str: Q2, keys: true },
	sql: { kw: SQL_KW, lit: set("true false null"), com: DASH, str: SQLQ, ci: true },
	conf: { kw: NONE, lit: set("true false null yes no on off"), com: HASH, str: [Q2, Q1].join("|"), prop: true },
	css: { kw: NONE, lit: NONE, com: String.raw`\/\*[\s\S]*?(?:\*\/|$)`, str: [Q2, Q1].join("|"), meta: String.raw`@[\w-]+`, metaCls: "k", num: CSS_NUM, word: String.raw`-?[A-Za-z_][\w-]*`, css: true },
	html: { html: true },
};

const ALIAS = {
	js: "js", jsx: "js", mjs: "js", cjs: "js", ts: "js", tsx: "js", javascript: "js", typescript: "js",
	py: "py", pyw: "py", python: "py",
	java: "c", kt: "c", kts: "c", c: "c", h: "c", cpp: "c", cc: "c", hpp: "c", cs: "c", go: "c", rs: "c", swift: "c", dart: "c", scala: "c", php: "c",
	sh: "sh", bash: "sh", zsh: "sh", shell: "sh",
	json: "json", jsonc: "json", json5: "json",
	sql: "sql",
	yml: "conf", yaml: "conf", toml: "conf", ini: "conf", conf: "conf", env: "conf", properties: "conf",
	css: "css", scss: "css", less: "css",
	html: "html", htm: "html", xml: "html", svg: "html", vue: "html",
};

const MAX_LEN = 20000; // longer code stays plain, so a big snippet never stalls the chat

// One regex per language: comment | string | meta | number | word, each in its own group.
function build(f) {
	const parts = [["c", f.com], ["s", f.str]];
	if (f.meta) parts.push(["m", f.meta]);
	parts.push(["n", f.num || NUM], ["w", f.word || WORD]);
	return { parts, re: new RegExp(parts.map(([, s]) => `(${s})`).join("|"), "g") };
}

// Collects text and spans into a fragment.
function sink() {
	const f = document.createDocumentFragment();
	return {
		f,
		text: (s) => {
			if (s) f.append(s);
		},
		add: (s, cls) => {
			if (!cls) return f.append(s);
			const $s = document.createElement("span");
			$s.className = `hl-${cls}`;
			$s.textContent = s;
			f.append($s);
		},
	};
}

// What a bare word is: keyword, literal, function call, property or type name (or nothing special).
function wordClass(w, code, end, f) {
	const k = f.ci ? w.toLowerCase() : w;
	if (f.kw.has(k)) return "k";
	if (f.lit.has(k)) return "n";
	if (f.css) {
		const line = code.slice(end, end + 160).split("\n")[0];
		return /^\s*:/.test(line) && !line.includes("{") ? "p" : null;
	}
	if (f.prop && /^\s*[:=]/.test(code.slice(end, end + 8))) return "p";
	if (code[end] === "(") return "f";
	if (f.type && /^[A-Z][\w$]*[a-z]/.test(w)) return "t";
	return null;
}

function run(code, f, out) {
	if (!f.built) f.built = build(f);
	const { parts, re } = f.built;
	re.lastIndex = 0;
	let last = 0;
	let m;
	while ((m = re.exec(code))) {
		if (!m[0]) {
			re.lastIndex++;
			continue;
		}
		let i = 1;
		while (m[i] === undefined) i++;
		const kind = parts[i - 1][0];
		const end = m.index + m[0].length;
		let cls;
		if (kind === "c") cls = "c";
		else if (kind === "s") cls = f.keys && /^\s*:/.test(code.slice(end, end + 24)) ? "p" : "s";
		else if (kind === "m") cls = f.metaCls || "m";
		else if (kind === "n") cls = "n";
		else cls = wordClass(m[0], code, end, f);
		if (m.index > last) out.text(code.slice(last, m.index));
		out.add(m[0], cls);
		last = end;
	}
	if (last < code.length) out.text(code.slice(last));
}

// HTML / XML: tag names, attribute names, attribute values and comments. Text between tags stays plain.
function runHtml(code, out) {
	const inTag = /\s+|\/?>|\?>|=|"[^"]*"?|'[^']*'?|[^\s=<>\/"']+|\//y;
	let i = 0; // where the search for the next "<" continues
	let text = 0; // start of the plain text not written out yet
	while (i < code.length) {
		const lt = code.indexOf("<", i);
		if (lt < 0) break;
		if (code.startsWith("<!--", lt)) {
			let e = code.indexOf("-->", lt + 4);
			e = e < 0 ? code.length : e + 3;
			out.text(code.slice(text, lt));
			out.add(code.slice(lt, e), "c");
			i = text = e;
			continue;
		}
		const tag = /^<[\/!?]?[A-Za-z][\w:.-]*/.exec(code.slice(lt, lt + 80));
		if (!tag) {
			i = lt + 1;
			continue;
		}
		out.text(code.slice(text, lt));
		out.add(tag[0], "k");
		let p = lt + tag[0].length;
		inTag.lastIndex = p;
		let m;
		while ((m = inTag.exec(code))) {
			const t = m[0];
			p = inTag.lastIndex;
			if (t[0] === '"' || t[0] === "'") out.add(t, "s");
			else if (/^[^\s=<>\/"']/.test(t)) out.add(t, "p");
			else out.text(t);
			if (t.endsWith(">")) break;
		}
		i = text = p;
	}
	if (text < code.length) out.text(code.slice(text));
}

/** Returns a DocumentFragment with the highlighted code, or null when the language is unknown (show it plain). */
export function highlight(code, lang) {
	const f = FAMILIES[ALIAS[String(lang || "").toLowerCase()]];
	if (!f || !code || code.length > MAX_LEN) return null;
	const out = sink();
	try {
		if (f.html) runHtml(code, out);
		else run(code, f, out);
	} catch {
		return null;
	}
	return out.f;
}
