// Bundles src/ into a single main.js, which is the only file Acode loads.
// No dependencies, just Node 18+:   node build.js        (or: node build.js --watch)
//
// How it works: starting at src/index.js it follows every `import "./x.js"`, puts each
// file ahead of the files that need it, strips the import/export keywords and wraps the
// lot in one function. `import CSS from "./styles.css"` becomes a plain string constant.
// "__PLUGIN_VERSION__" in the source is replaced with the version in plugin.json.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "src", "index.js");
const outFile = path.join(root, "main.js");
const IMPORT_RE = /^import\s+(?:([\w$]+)\s+from\s+|\{[^}]*\}\s+from\s+)?["']([^"']+)["'];?[ \t]*\n?/gm;

function bundle() {
	const version = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version;
	const done = new Set();
	const chunks = [];

	function visit(file) {
		if (done.has(file)) return;
		done.add(file);
		let code = fs.readFileSync(file, "utf8");
		const rel = path.relative(root, file);

		code = code.replace(IMPORT_RE, (_all, defaultName, spec) => {
			if (!spec.startsWith(".")) throw new Error(`${rel}: only relative imports are supported ("${spec}")`);
			const target = path.resolve(path.dirname(file), spec);
			if (target.endsWith(".css")) {
				if (!defaultName) throw new Error(`${rel}: write CSS imports as: import NAME from "${spec}"`);
				if (!done.has(target)) {
					done.add(target);
					const css = fs.readFileSync(target, "utf8").replace(/[\\`]|\$\{/g, (m) => "\\" + m);
					chunks.push(`const ${defaultName} = \`${css}\`;`);
				}
			} else if (!fs.existsSync(target)) {
				throw new Error(`${rel}: cannot find "${spec}"`);
			} else {
				visit(target);
			}
			return "";
		});

		code = code.replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|class|function)\b)/gm, "");
		if (/^export\b/m.test(code)) throw new Error(`${rel}: unsupported export form (use "export const/class/function")`);
		chunks.push(`// ---- ${rel.split(path.sep).join("/")} ----\n${code.trim()}`);
	}

	visit(entry);
	const out = chunks.join("\n\n").split("__PLUGIN_VERSION__").join(version);
	return `// Acode Messages v${version}. Copyright (c) 2026 heyitsaadin. All rights reserved.\n// Source-available, not open source: copying, republishing or deriving other plugins from this code is not allowed. See LICENSE.\n// Built by build.js from src/. Don't edit this file, edit the files in src/ instead.\n(() => {\n${out}\n})();\n`;
}

function build() {
	const started = Date.now();
	const code = bundle();
	new vm.Script(code, { filename: "main.js" }); // throws on syntax errors and duplicate top-level names
	fs.writeFileSync(outFile, code);
	console.log(`main.js written: ${(code.length / 1024).toFixed(1)} KB in ${Date.now() - started} ms`);
}

try {
	build();
} catch (e) {
	console.error("Build failed:", e.message);
	process.exit(1);
}

if (process.argv.includes("--watch")) {
	console.log("Watching src/ ...");
	let timer;
	fs.watch(path.join(root, "src"), { recursive: true }, () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			try {
				build();
			} catch (e) {
				console.error("Build failed:", e.message);
			}
		}, 150);
	});
}
