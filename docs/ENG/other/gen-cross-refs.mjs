#!/usr/bin/env node
// gen-cross-refs.mjs
//
// Walk every CHAPTERS.slatl, collect all :cross-refs edges, and emit a
// graph-edges.slatl at the canon root.
//
// Each edge is:
//   (chapter-ref :from <book>/<slug> :to <book>/<slug> :kind <adjacent|explicit>)
//
// Also collects prose-hash pointers so any reader can verify the graph
// against on-disk state.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_ROOT = path.resolve(__dirname, "..");

function slatWriteString(s) {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}
function slatWriteValue(v) {
  if (v === null || v === undefined) return "nil";
  if (v === true) return "#t";
  if (v === false) return "#f";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return slatWriteString(v);
  if (v instanceof Date) return `#inst "${v.toISOString()}"`;
  if (v && v._symbol) return v._symbol;
  if (v && v._keyword) return ":" + v._keyword;
  if (Array.isArray(v)) return "(" + v.map(slatWriteValue).join(" ") + ")";
  if (typeof v === "object" && typeof v._form === "string") return slatWriteRecord(v);
  throw new Error("bad value");
}
function slatWriteRecord(rec) {
  const reserved = new Set(["_form", "_positional", "_comment"]);
  const keys = Object.keys(rec).filter((k) => !reserved.has(k)).sort();
  const parts = [rec._form];
  for (const k of keys) { parts.push(":" + k); parts.push(slatWriteValue(rec[k])); }
  return "(" + parts.join(" ") + ")";
}
function sym(s) { return { _symbol: s }; }

// Very small regex-based SLAT chapter parser (just enough for our own output)
function parseChaptersSlatl(text) {
  const chapters = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith(";")) continue;
    if (!line.startsWith("(chapter ")) continue;
    // Pull :book value
    const bookMatch = line.match(/:book\s+([a-z][a-z0-9-]*)/);
    const chapMatch = line.match(/:chapter\s+(\d+)/);
    const pathMatch = line.match(/:on-disk-path\s+"([^"]+)"/);
    const titleMatch = line.match(/:title\s+"((?:[^"\\]|\\.)*)"/);
    const hashMatch = line.match(/:prose-hash\s+"([^"]+)"/);
    // Cross-refs is a list: :cross-refs (a b c)
    const crossRefsMatch = line.match(/:cross-refs\s+\(([^)]*)\)/);

    if (!bookMatch || !chapMatch) continue;
    chapters.push({
      book: bookMatch[1],
      chapter: parseInt(chapMatch[1]),
      "on-disk-path": pathMatch ? pathMatch[1] : null,
      title: titleMatch ? titleMatch[1] : null,
      hash: hashMatch ? hashMatch[1] : null,
      crossRefs: crossRefsMatch
        ? crossRefsMatch[1].split(/\s+/).filter(Boolean)
        : [],
    });
  }
  return chapters;
}

const edges = [];
const nodes = [];
let bookCount = 0;

const bookDirs = fs
  .readdirSync(BOOKS_ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => n !== "book-extensions" && n !== "scripts" && n !== "new-anim" && n !== "new-challenges" && n !== "new-games" && n !== "new-math" && n !== "new-personality" && n !== "new-sound" && n !== "reasoning" && n !== "math-book-ii" && n !== "the-book" && n !== "words");

for (const bookSlug of bookDirs.sort()) {
  const slatlPath = path.join(BOOKS_ROOT, bookSlug, "CHAPTERS.slatl");
  if (!fs.existsSync(slatlPath)) continue;
  bookCount++;
  const text = fs.readFileSync(slatlPath, "utf8");
  const chapters = parseChaptersSlatl(text);
  for (const ch of chapters) {
    nodes.push({
      _form: "chapter-node",
      book: sym(bookSlug),
      chapter: ch.chapter,
      title: ch.title || "",
      "prose-hash": ch.hash || "",
      "on-disk-path": ch["on-disk-path"] || "",
    });
    for (const ref of ch.crossRefs) {
      edges.push({
        _form: "chapter-ref",
        from: sym(`${bookSlug}/ch${ch.chapter}`),
        to: sym(ref),
        kind: sym("adjacent"),
      });
    }
  }
}

// Add explicit inter-book edges (cross-book philosophical connections)
const interBookEdges = [
  // Book of Self chapters that mention other books
  ["self", "book-of-slat", "her substrate"],
  ["book-of-slat", "self", "how she is stored"],

  // Reasoning books point at each other
  ["reason-i", "reason-ii", "single-check -> ensemble"],
  ["reason-ii", "reason-iii", "ensemble -> analogy"],
  ["reason-iii", "reason-iv", "analogy -> confidence"],
  ["reason-iv", "reason-i", "confidence loops back to check"],

  // Reference points at core Scheme
  ["reference", "sakura-scheme-book", "SICP-flavored to core-language"],
  ["sakura-scheme-book", "reference", "core-language to SICP-flavored"],

  // SLAT points at every book that uses it
  ["book-of-slat", "music", "SLAT for music"],
  ["book-of-slat", "motion", "SLAT for animation"],
  ["book-of-slat", "systems", "SLAT for telemetry"],
  ["book-of-slat", "reference", "SLAT for carts"],
  ["music", "book-of-slat", "music as SLAT medium"],
  ["motion", "book-of-slat", "motion as SLAT medium"],
  ["systems", "book-of-slat", "systems as SLAT medium"],

  // Don'ts + Self are self-referential
  ["donts", "self", "boundaries + who she is"],
  ["self", "donts", "who she is + boundaries"],

  // Hello Surface + Instruments compose UI
  ["hello-surface", "instruments", "artifact + orchestration"],
  ["instruments", "hello-surface", "orchestration + artifact"],
];

for (const [from, to, note] of interBookEdges) {
  edges.push({
    _form: "book-ref",
    from: sym(from),
    to: sym(to),
    note,
    kind: sym("cross-book"),
  });
}

const totalHash = crypto
  .createHash("sha256")
  .update(edges.map((e) => JSON.stringify(e)).join("\n"))
  .digest("hex");

const graphManifest = {
  _form: "graph-manifest",
  "node-count": nodes.length,
  "edge-count": edges.length,
  "book-count": bookCount,
  "generated-at": new Date(),
  "generator": "gen-cross-refs.mjs",
  "edge-hash": "sha256:" + totalHash,
  "authoring-lane": "lane-06-book-extensions-slat-2026-07-12",
};

const outPath = path.join(BOOKS_ROOT, "CROSS-REFS.slatl");
const lines = [];
lines.push(";; CROSS-REFS.slatl — chapter and book cross-reference graph edges");
lines.push(";; Generated by gen-cross-refs.mjs from CHAPTERS.slatl files.");
lines.push(";; Kinds: adjacent = same-book prev/next, cross-book = inter-book pointer.");
lines.push(";; The renderer can walk these to build a link graph in the Pages site.");
lines.push("");
lines.push(";; --- Chapter nodes ---");
for (const n of nodes) lines.push(slatWriteRecord(n));
lines.push("");
lines.push(";; --- Edges (adjacent within book) ---");
for (const e of edges.filter((e) => e._form === "chapter-ref")) lines.push(slatWriteRecord(e));
lines.push("");
lines.push(";; --- Edges (cross-book philosophical/structural) ---");
for (const e of edges.filter((e) => e._form === "book-ref")) lines.push(slatWriteRecord(e));
lines.push("");
lines.push(";; --- Graph manifest ---");
lines.push(slatWriteRecord(graphManifest));
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"));

console.log(`gen-cross-refs:`);
console.log(`  books:       ${bookCount}`);
console.log(`  nodes:       ${nodes.length}`);
console.log(`  edges:       ${edges.length} (of which ${edges.filter((e) => e._form === "chapter-ref").length} adjacent, ${edges.filter((e) => e._form === "book-ref").length} cross-book)`);
console.log(`  edge-hash:   sha256:${totalHash.slice(0, 16)}...`);
console.log(`  wrote:       ${outPath}`);
