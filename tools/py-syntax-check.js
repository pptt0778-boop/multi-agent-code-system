/**
 * Minimal Python syntax sanity checker (no Python runtime available on host).
 * Checks balanced brackets/quotes/parentheses per file — catches the most
 * common editing mistakes. Not a full parser.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "backend");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith(".py")) yield p;
  }
}

function check(file) {
  const src = fs.readFileSync(file, "utf8");
  const stack = [];
  let inStr = null; // ' " ''' """
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") line++;
    if (inStr) {
      if (inStr.length === 3) {
        if (src.startsWith(inStr, i)) { inStr = null; i += 3; continue; }
      } else if (ch === "\\") { i += 2; continue; }
      else if (ch === inStr) { inStr = null; }
      i++;
      continue;
    }
    if (ch === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (src.startsWith('"""', i)) { inStr = '"""'; i += 3; continue; }
    if (src.startsWith("'''", i)) { inStr = "'''"; i += 3; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; i++; continue; }
    if ("([{".includes(ch)) stack.push({ ch, line });
    if (")]}".includes(ch)) {
      const open = stack.pop();
      const pairs = { ")": "(", "]": "[", "}": "{" };
      if (!open || open.ch !== pairs[ch]) {
        return `unbalanced '${ch}' at line ${line}`;
      }
    }
    i++;
  }
  if (inStr) return `unterminated string ${inStr}`;
  if (stack.length) return `unclosed '${stack[stack.length - 1].ch}' from line ${stack[stack.length - 1].line}`;
  return null;
}

let failures = 0;
for (const file of walk(ROOT)) {
  const err = check(file);
  if (err) {
    failures++;
    console.error(`FAIL ${path.relative(ROOT, file)}: ${err}`);
  } else {
    console.log(`ok   ${path.relative(ROOT, file)}`);
  }
}
process.exit(failures ? 1 : 0);
