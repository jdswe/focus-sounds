// Lint step with zero dependencies: syntax-checks every script, verifies that all locales
// share the same keys, and that every literal translation key used in the UI exists.
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dirs = [".", "js", "js/core", "js/domain", "js/ui", "tests", "scripts"];
const problems = [];

async function scripts(dir) {
  try {
    return (await readdir(dir)).filter((name) => /\.m?js$/.test(name)).map((name) => join(dir, name));
  } catch {
    return [];
  }
}

const files = (await Promise.all(dirs.map(scripts))).flat();
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    problems.push(`Syntax error in ${file}\n${error.stderr}`);
  }
}

const { messages } = require("../js/core/i18n-messages.js");
const base = Object.keys(messages.en);
for (const [locale, table] of Object.entries(messages)) {
  const missing = base.filter((key) => !(key in table));
  const extra = Object.keys(table).filter((key) => !(key in messages.en));
  if (missing.length || extra.length) {
    problems.push(`Locale "${locale}" mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`);
  }
  Object.entries(table).forEach(([key, value]) => {
    const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    if (messages.en[key] && placeholders(value) !== placeholders(messages.en[key])) problems.push(`Locale "${locale}" key "${key}" has different placeholders.`);
  });
}

const prefixes = new Set(base.map((key) => key.split(".")[0]));
const uiFiles = ["index.html", ...files.filter((file) => /^js[\\/](ui|domain)|^js[\\/][^\\/]+\.js$/.test(file))];
const unknown = new Set();
for (const file of uiFiles) {
  const text = await readFile(file, "utf8");
  for (const [, key] of text.matchAll(/["'`:]([a-z]+(?:\.[a-zA-Z0-9-]+)+)["'`;]/g)) {
    if (prefixes.has(key.split(".")[0]) && !(key in messages.en) && !/\.(js|css|html|svg|png|json|md|mjs)$/.test(key)) unknown.add(`${key} (${file})`);
  }
}
if (unknown.size) problems.push(`Keys used but not defined in English:\n  ${[...unknown].join("\n  ")}`);

if (problems.length) {
  console.error(problems.join("\n\n"));
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}
console.log(`${files.length} scripts parse; ${Object.keys(messages).length} locales share ${base.length} keys; all UI keys are defined.`);
