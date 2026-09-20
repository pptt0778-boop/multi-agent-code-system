/**
 * Publishes the monorepo to GitHub via the Git Data API (no git binary needed):
 *   1. create blobs for every file
 *   2. create a tree
 *   3. create a commit
 *   4. create/update refs/heads/main
 *   5. enable GitHub Pages (Actions build)
 *
 * Usage: GH_TOKEN=... node tools/github-publish.js
 */
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GH_TOKEN;
const OWNER = "pptt0778-boop";
const REPO = "multi-agent-code-system";
const BRANCH = "probe-write";
const ROOT = path.join(__dirname, "..");
const API = "https://api.github.com";

if (!TOKEN) {
  console.error("GH_TOKEN env var is required");
  process.exit(1);
}

// Files/dirs never pushed (mirrors .gitignore).
const EXCLUDE = new Set([
  "node_modules", ".next", "out", "__pycache__", ".pytest_cache",
  ".venv", "venv", ".git", "data",
]);
const EXCLUDE_FILES = new Set([
  "npm-install.log", "build.log", "publish.log", "tsconfig.tsbuildinfo", ".env",
]);
// Probe artifacts created during publish debugging — never commit these.
const EXCLUDE_PATHS = new Set(["probe.txt", "hello.txt"]);

function* walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name) || EXCLUDE_FILES.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (EXCLUDE_PATHS.has(rel)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, rel);
    else if (entry.isFile()) yield { rel, full };
  }
}

async function gh(method, url, body, attempt = 0) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "macs-publisher",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    // Retry transient failures (404 on freshly-initialized repos, 5xx, 429).
    if ([404, 409, 429, 500, 502, 503].includes(res.status) && attempt < 4) {
      const delay = 1000 * (attempt + 1);
      console.log(`  retry ${method} ${url} (${res.status}) in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      return gh(method, url, body, attempt + 1);
    }
    throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  const files = [...walk(ROOT)].sort((a, b) => a.rel.localeCompare(b.rel));
  console.log(`staging ${files.length} files`);
  for (const f of files) console.log(`  + ${f.rel}`);

  // 1. Blobs (parallel, chunked to be polite to the API)
  const treeItems = [];
  const CHUNK = 8;
  for (let i = 0; i < files.length; i += CHUNK) {
    const batch = files.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map((f) =>
        gh("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
          content: fs.readFileSync(f.full).toString("base64"),
          encoding: "base64",
        }),
      ),
    );
    results.forEach((blob, j) =>
      treeItems.push({
        path: batch[j].rel,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      }),
    );
    console.log(`blobs ${Math.min(i + CHUNK, files.length)}/${files.length}`);
  }

  // 2. Tree — chunked into subtrees per top-level directory because the
  // Git Data API rejects a single oversized flat tree on fresh repos.
  const groups = new Map(); // top-level dir ("" = root) -> entries
  for (const item of treeItems) {
    const slash = item.path.indexOf("/");
    const top = slash === -1 ? "" : item.path.slice(0, slash);
    const rest = slash === -1 ? null : item.path.slice(slash + 1);
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push({ ...item, rel: rest ?? item.path });
  }

  async function buildTree(entries) {
    // entries have paths relative to this subtree; nest as needed.
    const direct = [];
    const subdirs = new Map();
    for (const e of entries) {
      const slash = e.rel.indexOf("/");
      if (slash === -1) {
        direct.push({ path: e.rel, mode: e.mode, type: "blob", sha: e.sha });
      } else {
        const dir = e.rel.slice(0, slash);
        const rest = e.rel.slice(slash + 1);
        if (!subdirs.has(dir)) subdirs.set(dir, []);
        subdirs.get(dir).push({ ...e, rel: rest });
      }
    }
    const tree = [...direct];
    for (const [dir, sub] of subdirs) {
      const subTree = await buildTree(sub);
      tree.push({ path: dir, mode: "040000", type: "tree", sha: subTree.sha });
    }
    return gh("POST", `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  }

  console.log(`building tree from ${treeItems.length} blobs (chunked)`);
  const rootEntries = [];
  for (const [top, entries] of groups) {
    if (top === "") {
      for (const e of entries) {
        rootEntries.push({ path: e.rel, mode: e.mode, type: "blob", sha: e.sha });
      }
    } else {
      const subTree = await buildTree(entries);
      console.log(`  subtree ${top}/ -> ${subTree.sha.slice(0, 8)}`);
      rootEntries.push({ path: top, mode: "040000", type: "tree", sha: subTree.sha });
    }
  }
  const tree = await gh("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
    tree: rootEntries,
  });
  console.log(`tree ${tree.sha}`);

  // 3. Commit (attach to previous head if the branch already exists)
  let parents = [];
  try {
    const ref = await gh("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    parents = [ref.object.sha];
  } catch {
    /* first commit */
  }
  const commit = await gh("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message:
      "feat: multi-agent code system — dual-agent platform (Coder⇄Judge), Docker sandbox, GitHub integration\n\n" +
      "- frontend: Next.js 14 + Tailwind + Framer Motion + Monaco workspace\n" +
      "- backend: FastAPI + LiteLLM proxy + orchestrator + encrypted key vault\n" +
      "- ci: GitHub Pages static-export deploy workflow",
    tree: tree.sha,
    parents,
  });
  console.log(`commit ${commit.sha}`);

  // 4. Create or update the main branch ref
  try {
    await gh("POST", `/repos/${OWNER}/${REPO}/git/refs`, {
      ref: `refs/heads/${BRANCH}`,
      sha: commit.sha,
    });
    console.log(`ref created: refs/heads/${BRANCH}`);
  } catch {
    await gh("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      sha: commit.sha,
      force: true,
    });
    console.log(`ref updated: refs/heads/${BRANCH}`);
  }

  // 5. Enable GitHub Pages (built from the Actions workflow)
  try {
    await gh("POST", `/repos/${OWNER}/${REPO}/pages`, {
      build_type: "workflow",
      source: { branch: BRANCH, path: "/" },
    });
    console.log("pages enabled (workflow build)");
  } catch (e) {
    console.log(`pages enable note: ${e.message.slice(0, 200)}`);
  }

  console.log("\n=== PUBLISHED ===");
  console.log(`repo:  https://github.com/${OWNER}/${REPO}`);
  console.log(`pages: https://${OWNER}.github.io/${REPO}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
