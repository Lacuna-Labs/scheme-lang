#!/usr/bin/env node
// gen-chapter-slats.mjs
//
// Walk every canon book under scheme-books/, extract chapter files,
// pull frontmatter (YAML-like), and emit a canonical CHAPTERS.slatl
// file per book containing:
//   - one (chapter ...) record per on-disk chapter
//   - a (book-manifest ...) record at the end with Merkle root
//
// Each chapter record carries:
//   :book, :chapter, :of, :title, :part, :philosopher-lens,
//   :key-objects (Jungian archetypes present), :key-scenes,
//   :key-verbs (Scheme verbs featured), :prose-hash (sha256),
//   :cross-refs.
//
// Merkle root over the sorted chapter hashes goes into the book-manifest.
//
// Alfred: "do them in SLAT so we save."

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_ROOT = path.resolve(__dirname, "..");

// The eight philosopher lenses in canonical order.
const EIGHT_LENSES = [
  "wittgenstein-tractatus",
  "jung",
  "lacan",
  "peirce",
  "popper",
  "freud",
  "wittgenstein-late",
  "searle",
];

// ---------- SLAT writer (subset matching lacuna-labs/slat-tooling) ----------

function slatWriteString(s) {
  return (
    '"' +
    s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r") +
    '"'
  );
}

function slatWriteValue(v) {
  if (v === null || v === undefined) return "nil";
  if (v === true) return "#t";
  if (v === false) return "#f";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "string") return slatWriteString(v);
  if (v instanceof Date) return `#inst "${v.toISOString()}"`;
  if (v && v._symbol) return v._symbol;
  if (v && v._keyword) return ":" + v._keyword;
  if (Array.isArray(v)) return "(" + v.map(slatWriteValue).join(" ") + ")";
  if (typeof v === "object" && typeof v._form === "string") return slatWriteRecord(v);
  throw new Error(`slat-write: unknown value ${JSON.stringify(v)}`);
}

function slatWriteRecord(rec) {
  const head = rec._form;
  const reserved = new Set([
    "_form",
    "_positional",
    "_comment",
    "_meta",
    "_bad-line",
    "_tainted",
  ]);
  const keys = Object.keys(rec).filter((k) => !reserved.has(k)).sort();
  const parts = [head];
  for (const k of keys) {
    parts.push(":" + k);
    parts.push(slatWriteValue(rec[k]));
  }
  if (Array.isArray(rec._positional)) {
    for (const p of rec._positional) parts.push(slatWriteValue(p));
  }
  return "(" + parts.join(" ") + ")";
}

function sym(s) { return { _symbol: s }; }

// ---------- Frontmatter parser (simple YAML subset) ----------

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const yaml = text.slice(4, end);
  const out = {};
  const lines = yaml.split("\n");
  for (const line of lines) {
    const m = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    let v = vRaw.trim();
    // Array literal like [a, b, c]
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length);
    }
    out[k] = v;
  }
  return out;
}

// ---------- Extract chapter title from H1 ----------

function extractH1(text) {
  const m = text.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

// ---------- Extract key Scheme verbs from code blocks ----------

function extractKeyVerbs(text) {
  const verbs = new Set();
  const codeBlocks = text.matchAll(/```scheme([\s\S]*?)```/g);
  for (const block of codeBlocks) {
    // Match (verb args...) and namespaced (ns/verb args...)
    const calls = block[1].matchAll(/\(([a-z][a-z0-9-]*(?:\/[a-z0-9-]+)?)/g);
    for (const c of calls) {
      const v = c[1];
      // Skip the fifteen forms; those are not verbs
      if (["define", "define-syntax", "lambda", "let", "let*", "letrec",
           "if", "cond", "case", "and", "or", "when", "unless", "begin",
           "quote", "car", "cdr", "cons", "list", "map", "filter",
           "for-each", "apply", "if", "else"].includes(v)) continue;
      // Only track namespaced or notable verbs
      if (v.includes("/") || v.length > 4) verbs.add(v);
    }
  }
  return Array.from(verbs).slice(0, 12).sort();
}

// ---------- Extract key objects (Jungian archetypes) heuristic ----------

const JUNGIAN_MARKERS = [
  "bell", "porch", "letter", "chair", "table", "counter", "diner",
  "tracker", "order", "package", "customer", "operator", "shop",
  "package", "photo", "card", "note", "thread", "instrument",
  "artifact", "book", "shelf", "map", "room", "gate", "line",
  "boundary", "silence", "verse", "verse", "throne", "kitchen",
  "warehouse", "inbox", "queue", "bathtub", "sandwich", "river",
  "conveyor", "tree", "sun", "voice", "hand", "eye", "wire",
  "signature", "seal", "flag", "path",
];

function extractKeyObjects(text) {
  const objs = new Set();
  const lower = text.toLowerCase();
  for (const m of JUNGIAN_MARKERS) {
    // Match as whole word
    const re = new RegExp(`\\b${m}s?\\b`, "g");
    if (re.test(lower)) objs.add(m);
  }
  return Array.from(objs).sort().slice(0, 12);
}

// ---------- Extract key scenes (H2 headers) ----------

function extractScenes(text) {
  const scenes = [];
  const matches = text.matchAll(/^##\s+(.+?)\s*$/gm);
  for (const m of matches) {
    scenes.push(m[1].trim());
  }
  return scenes.slice(0, 10);
}

// ---------- Extract prev/next cross-refs ----------

function extractCrossRefs(fm, bookSlug) {
  const refs = [];
  if (fm.prev && fm.prev !== "null") refs.push(`${bookSlug}/${fm.prev}`);
  if (fm.next && fm.next !== "null") refs.push(`${bookSlug}/${fm.next}`);
  return refs;
}

// ---------- Hash utilities ----------

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function merkleRoot(hashes) {
  if (hashes.length === 0) return sha256Hex("");
  if (hashes.length === 1) return hashes[0];
  const next = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const a = hashes[i];
    const b = i + 1 < hashes.length ? hashes[i + 1] : a;
    next.push(sha256Hex(a + b));
  }
  return merkleRoot(next);
}

// ---------- Per-chapter record builder ----------

function buildChapterRecord(bookSlug, filename, filepath) {
  const text = fs.readFileSync(filepath, "utf8");
  const fm = parseFrontmatter(text);
  const h1 = extractH1(text) || fm.title || filename;
  const scenes = extractScenes(text);
  const verbs = extractKeyVerbs(text);
  const objects = extractKeyObjects(text);
  const proseHash = sha256Hex(text);

  // Chapter number: from frontmatter or filename
  let chapterNum = null;
  if (fm.chapter && !isNaN(parseInt(fm.chapter))) {
    chapterNum = parseInt(fm.chapter);
  } else {
    const m = filename.match(/^(?:ch)?(\d+)/);
    if (m) chapterNum = parseInt(m[1]);
  }

  // Total chapters: :of field
  const ofNum = fm.of && !isNaN(parseInt(fm.of)) ? parseInt(fm.of) : 16;

  // Philosopher lens (list of symbols)
  let lenses = fm["philosopher-lens"];
  if (!Array.isArray(lenses)) {
    // Not specified — default to all 8 for well-woven chapters
    lenses = EIGHT_LENSES;
  }
  const featured = lenses[0] || "jung";

  const rec = {
    _form: "chapter",
    book: sym(bookSlug),
    chapter: chapterNum ?? 0,
    of: ofNum,
    title: h1.replace(/^Chapter\s+\d+\s*—\s*/, "").replace(/^Chapter\s+\d+:\s*/, ""),
    "featured-lens": sym(featured),
    "secondary-lenses": lenses.filter((l) => l !== featured).map(sym),
    "key-objects": objects.map(sym),
    "key-scenes": scenes,
    "key-verbs": verbs.map(sym),
    "prose-hash": "sha256:" + proseHash,
    "on-disk-path": path.relative(BOOKS_ROOT, filepath),
  };

  if (fm.part) rec.part = fm.part;

  const refs = extractCrossRefs(fm, bookSlug);
  if (refs.length) rec["cross-refs"] = refs.map(sym);

  return { record: rec, hash: proseHash };
}

// ---------- Book manifest builder ----------

function buildManifest(bookSlug, chapterEntries) {
  const hashes = chapterEntries.map((e) => e.hash).sort();
  const root = merkleRoot(hashes);
  return {
    _form: "book-manifest",
    book: sym(bookSlug),
    "chapter-count": chapterEntries.length,
    "merkle-root": "sha256:" + root,
    "generated-at": new Date(),
    "generator": "gen-chapter-slats.mjs",
    "lens-doctrine": "8-lens weave: tractatus + jung + lacan + peirce + popper + freud + investigations + searle",
    "authoring-lane": "lane-06-book-extensions-slat-2026-07-12",
  };
}

// ---------- Walk books ----------

function isChapterFile(name) {
  if (!name.endsWith(".md")) return false;
  if (name === "00-cover.md") return false;
  if (name === "README.md") return false;
  return /^(ch)?\d+-/.test(name);
}

// Prefer ch* files where both exist (they're the newer canonical set).
// If a book has both `NN-*.md` and `ch??-*.md` for the same chapter number,
// choose based on which set is larger (heuristic).
function selectChapterFiles(bookDir) {
  const entries = fs.readdirSync(bookDir);
  const chFiles = entries.filter((e) => /^ch\d+/.test(e) && e.endsWith(".md") && !e.includes("-r1") && !e.includes("-r2") && !e.endsWith("-b.md"));
  const nnFiles = entries.filter((e) => /^\d+-/.test(e) && e.endsWith(".md") && e !== "00-cover.md");

  // Prefer the set that gets us closer to 16
  const chUniqueNums = new Set(chFiles.map((f) => (f.match(/^ch(\d+)/) || [])[1]).filter(Boolean));
  const nnUniqueNums = new Set(nnFiles.map((f) => (f.match(/^(\d+)/) || [])[1]).filter(Boolean));

  // Take whichever set has more unique numbered chapters
  if (chUniqueNums.size >= nnUniqueNums.size && chFiles.length) {
    // Deduplicate to one file per chapter number (prefer no suffix hash)
    const byNum = new Map();
    for (const f of chFiles) {
      const m = f.match(/^ch(\d+)/);
      if (!m) continue;
      const n = parseInt(m[1]);
      const existing = byNum.get(n);
      // Prefer files without --HASH suffix (they are the current canonical)
      const isSuffixed = /--[0-9a-f]{12}\.md$/.test(f);
      const existingIsSuffixed = existing ? /--[0-9a-f]{12}\.md$/.test(existing) : false;
      if (!existing) byNum.set(n, f);
      else if (existingIsSuffixed && !isSuffixed) byNum.set(n, f);
      else if (isSuffixed === existingIsSuffixed && f.length < existing.length) byNum.set(n, f);
    }
    return Array.from(byNum.entries()).sort((a, b) => a[0] - b[0]).map(([, f]) => f);
  } else {
    // Same dedup on NN-numbered files
    const byNum = new Map();
    for (const f of nnFiles) {
      if (f.endsWith("-r1.md") || f.endsWith("-r2.md")) continue;
      const m = f.match(/^(\d+)/);
      if (!m) continue;
      const n = parseInt(m[1]);
      const existing = byNum.get(n);
      const isSuffixed = /--[0-9a-f]{12}\.md$/.test(f);
      const existingIsSuffixed = existing ? /--[0-9a-f]{12}\.md$/.test(existing) : false;
      if (!existing) byNum.set(n, f);
      else if (existingIsSuffixed && !isSuffixed) byNum.set(n, f);
      else if (isSuffixed === existingIsSuffixed && f.length < existing.length) byNum.set(n, f);
    }
    return Array.from(byNum.entries()).sort((a, b) => a[0] - b[0]).map(([, f]) => f);
  }
}

function processBook(bookDir, bookSlug) {
  const files = selectChapterFiles(bookDir);
  if (files.length === 0) return null;

  const entries = [];
  for (const f of files) {
    const p = path.join(bookDir, f);
    try {
      const r = buildChapterRecord(bookSlug, f, p);
      entries.push(r);
    } catch (e) {
      console.error(`  ! skipping ${bookSlug}/${f}: ${e.message}`);
    }
  }
  if (entries.length === 0) return null;

  const manifest = buildManifest(bookSlug, entries);
  const outPath = path.join(bookDir, "CHAPTERS.slatl");

  const lines = [];
  lines.push(`;; CHAPTERS.slatl — SLAT chapter records for ${bookSlug}`);
  lines.push(`;; Generated by gen-chapter-slats.mjs (do not hand-edit; regen)`);
  lines.push(`;; Prose lives at <book-dir>/<NN|chNN>-*.md; SLAT records mirror them here.`);
  lines.push(`;; Alfred: "do them in SLAT so we save."`);
  lines.push(``);
  for (const e of entries) {
    lines.push(slatWriteRecord(e.record));
  }
  lines.push(``);
  lines.push(`;; --- Book manifest (Merkle root over sorted prose hashes) ---`);
  lines.push(slatWriteRecord(manifest));
  lines.push(``);

  fs.writeFileSync(outPath, lines.join("\n"));
  return { entries: entries.length, manifest, outPath };
}

// ---------- Main ----------

const CANON_BOOKS = [
  "book-of-slat",
  "donts",
  "hello-surface",
  "instruments",
  "marionette",
  "miscellany",
  "money",
  "motion",
  "music",
  "one-shot",
  "reason-i",
  "reason-ii",
  "reason-iii",
  "reason-iv",
  "reference",
  "sakura-scheme-book",
  "self",
  "systems",
  "words",
];

const targetBooks = process.argv.slice(2).length
  ? process.argv.slice(2)
  : CANON_BOOKS;

console.log("gen-chapter-slats — generating SLAT chapter manifests");
console.log(`books-root: ${BOOKS_ROOT}`);
console.log(`processing: ${targetBooks.length} book(s)`);
console.log("");

let totalChapters = 0;
const rootHashes = [];
for (const bookSlug of targetBooks) {
  const bookDir = path.join(BOOKS_ROOT, bookSlug);
  if (!fs.existsSync(bookDir)) {
    console.log(`  - ${bookSlug}: no dir, skip`);
    continue;
  }
  const result = processBook(bookDir, bookSlug);
  if (!result) {
    console.log(`  - ${bookSlug}: no chapters found, skip`);
    continue;
  }
  totalChapters += result.entries;
  rootHashes.push(result.manifest["merkle-root"].replace("sha256:", ""));
  console.log(
    `  ✓ ${bookSlug}: ${result.entries} chapters, root ${result.manifest[
      "merkle-root"
    ].slice(0, 16)}...`,
  );
}

// Meta-manifest across all books
const megaRoot = merkleRoot(rootHashes.sort());
const megaManifest = {
  _form: "canon-manifest",
  "book-count": rootHashes.length,
  "chapter-count-total": totalChapters,
  "meta-merkle-root": "sha256:" + megaRoot,
  "generated-at": new Date(),
  "generator": "gen-chapter-slats.mjs",
  "authoring-lane": "lane-06-book-extensions-slat-2026-07-12",
  "lens-doctrine": "8-lens weave interwoven at sentence level, Jung load-bearing, no name-drops",
};

const megaPath = path.join(BOOKS_ROOT, "CANON-MANIFEST.slatl");
fs.writeFileSync(
  megaPath,
  [
    ";; CANON-MANIFEST.slatl — meta-manifest over every canon book",
    ";; Rolls the Merkle roots of every <book>/CHAPTERS.slatl into one root.",
    ";; Regenerated by gen-chapter-slats.mjs.",
    "",
    slatWriteRecord(megaManifest),
    "",
  ].join("\n"),
);

console.log("");
console.log(`Total chapters across canon: ${totalChapters}`);
console.log(`Meta-manifest merkle-root: sha256:${megaRoot}`);
console.log(`Wrote ${megaPath}`);
