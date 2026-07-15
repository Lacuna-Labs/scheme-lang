#!/usr/bin/env node
// Recovery Lane 2 runner — Misfiled Books (recovery-008, 009, 010, 011)
// Alfred's directive 2026-07-14. NO DELETES. Every move logged.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RECOVERED_AT = '2026-07-14';
const LOG_PATH = '/Users/alfred/code/curator/docs/reports/recovery-log-2026-07-14.slat';
const REPORT_PATH = '/Users/alfred/code/scheme-lang/docs/reports/recovery-lane-2-report-2026-07-14.slat';

// --- utilities -------------------------------------------------------

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escapeSlatString(s) {
  // SLAT strings use double-quotes; escape backslash and double-quote,
  // preserve newlines as-is (SLAT reader tolerates literal newlines).
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function wrapChapter({
  book, chapterNumber, title, sourcePath, sourceSha, recoveryItem, prose,
  arc, part, notes,
}) {
  const parts = [];
  parts.push('(chapter');
  parts.push(`  :book "${escapeSlatString(book)}"`);
  if (chapterNumber !== null && chapterNumber !== undefined) {
    parts.push(`  :chapter-number ${chapterNumber}`);
  } else {
    parts.push('  :chapter-number null');
  }
  parts.push(`  :title "${escapeSlatString(title)}"`);
  if (part) parts.push(`  :part "${escapeSlatString(part)}"`);
  if (arc) parts.push(`  :arc "${escapeSlatString(arc)}"`);
  parts.push('  :provenance');
  parts.push(`    (:source-path "${escapeSlatString(sourcePath)}"`);
  parts.push(`     :source-sha "${sourceSha}"`);
  parts.push(`     :recovered-at "${RECOVERED_AT}"`);
  parts.push(`     :recovery-item "${recoveryItem}")`);
  if (notes) parts.push(`  :notes "${escapeSlatString(notes)}"`);
  parts.push('  :prose');
  parts.push(`"${escapeSlatString(prose)}")`);
  return parts.join('\n') + '\n';
}

const moves = [];

function logMove(from, to, verification) {
  moves.push({ from, to, verification, date: RECOVERED_AT });
}

function writeLog() {
  const lines = [];
  lines.push(';; Recovery Lane 2 — Misfiled Books');
  lines.push(';; Generated 2026-07-14 by .recovery-lane-2-runner.mjs');
  lines.push('');
  for (const m of moves) {
    lines.push('(moved');
    lines.push(`  :from "${escapeSlatString(m.from)}"`);
    lines.push(`  :to "${escapeSlatString(m.to)}"`);
    lines.push(`  :date "${m.date}"`);
    lines.push(`  :verification "${escapeSlatString(m.verification)}")`);
  }
  ensureDir(path.dirname(LOG_PATH));
  // Append (never truncate — other lanes may add)
  let existing = '';
  if (fs.existsSync(LOG_PATH)) existing = fs.readFileSync(LOG_PATH, 'utf8');
  fs.writeFileSync(LOG_PATH, existing + lines.join('\n') + '\n\n');
}

// --- chunker for BOOK-OF-JESSE.md (recovery-008) --------------------

function chunkJesseByHeading(sourcePath) {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const sourceSha = sha256(raw);
  const lines = raw.split('\n');

  // Boundaries are level-2 headings (## ...) — Chapter / Appendix / Dedication.
  // We also treat leading H1 (# The Book of Jesse) + intro as the "00-cover" chunk.
  const chunks = [];
  let current = { heading: null, headingLevel: 0, contentLines: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only split on H2 (## ...) — H3 stays inside its H2.
    if (/^## /.test(line)) {
      // flush prior
      if (current.contentLines.length > 0 || current.heading) {
        chunks.push(current);
      }
      current = { heading: line.replace(/^## /, '').trim(), headingLevel: 2, contentLines: [line] };
    } else {
      current.contentLines.push(line);
    }
  }
  if (current.contentLines.length > 0 || current.heading) chunks.push(current);

  // Now name each chunk semantically.
  // First chunk contains: # The Book of Jesse + subtitle + --- + Dedication section start (but dedication is H2)
  // Actually dedication IS H2, so first chunk = book intro before first H2 (title + subtitle only).
  const named = [];
  const seen = new Set();
  let seq = 0;

  for (const c of chunks) {
    let slug;
    let title;
    if (c.heading === null) {
      // Pre-heading intro block — cover
      slug = '00-cover';
      title = 'The Book of Jesse (Cover)';
    } else {
      title = c.heading;
      slug = slugifyJesse(c.heading, seq);
    }
    // Ensure uniqueness
    let s = slug;
    let dedupe = 2;
    while (seen.has(s)) {
      s = `${slug}-${dedupe}`;
      dedupe++;
    }
    seen.add(s);
    named.push({ slug: s, title, heading: c.heading, content: c.contentLines.join('\n') });
    seq++;
  }
  return { sourceSha, chunks: named, sourceRaw: raw };
}

function slugifyJesse(heading, seq) {
  // heading examples:
  //   "Dedication"
  //   "Chapter 1 — Install"
  //   "Chapter 5.5 — Entities and Parts (still Layer 1)"
  //   "Appendix A — Macros in ~10 minutes"
  //   "Chapter 15 — Closing"
  const chMatch = heading.match(/^Chapter\s+([\d.]+)\s*[—-]\s*(.+)$/);
  if (chMatch) {
    const num = chMatch[1].replace('.', '-'); // 5.5 -> 5-5
    const rest = chMatch[2];
    const slug = slugify(rest);
    // Pad chapter num for sort where possible.
    const padNum = /^\d+$/.test(num) ? num.padStart(2, '0') : num.replace(/^(\d+)-/, (_, a) => a.padStart(2, '0') + '-');
    return `${padNum}-${slug}`;
  }
  const appMatch = heading.match(/^Appendix\s+([A-Z])\s*[—-]\s*(.+)$/);
  if (appMatch) {
    return `appendix-${appMatch[1].toLowerCase()}-${slugify(appMatch[2])}`;
  }
  // Dedication or freeform
  return `${String(seq).padStart(2, '0')}-${slugify(heading)}`;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[—–—]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

// --- recovery-008 ---------------------------------------------------

function doRecovery008() {
  console.log('=== recovery-008: Book of Jesse chunking ===');
  const src = '/Users/alfred/code/scheme-lang/docs/BOOK-OF-JESSE.md';
  const dst = '/Users/alfred/code/curator/scheme-books/book-of-jesse';
  ensureDir(dst);
  const { sourceSha, chunks, sourceRaw } = chunkJesseByHeading(src);

  const chapterRecords = [];
  let chapterNumber = 0;
  const bookName = 'Book of Jesse';

  // Verification: concatenate chunk content in order and diff against source.
  const rebuilt = chunks.map((c) => c.content).join('\n');
  if (rebuilt !== sourceRaw.replace(/\n$/, '') && rebuilt + '\n' !== sourceRaw && rebuilt !== sourceRaw) {
    // Check length + last-line handling
    const trimmedSrc = sourceRaw.endsWith('\n') ? sourceRaw.slice(0, -1) : sourceRaw;
    if (rebuilt !== trimmedSrc) {
      console.error('CONTENT-LOSS: rebuilt Jesse does not equal source');
      console.error(`  rebuilt len=${rebuilt.length} sourceRaw len=${sourceRaw.length}`);
      // Find first divergence
      for (let i = 0; i < Math.min(rebuilt.length, sourceRaw.length); i++) {
        if (rebuilt[i] !== sourceRaw[i]) {
          console.error(`  first diff at char ${i}: rebuilt='${rebuilt.slice(i, i + 40)}' source='${sourceRaw.slice(i, i + 40)}'`);
          break;
        }
      }
      throw new Error('Jesse chunk verification failed');
    }
  }
  console.log(`  verified: ${chunks.length} chunks concatenate to source exactly (mod trailing newline)`);

  for (const c of chunks) {
    const outPath = path.join(dst, `${c.slug}.book.slatl`);
    // Assign chapter numbers: 0 for cover, then monotonic
    let chNum;
    let titleFinal = c.title;
    if (c.slug === '00-cover') chNum = 0;
    else if (c.slug.startsWith('appendix-')) chNum = null;
    else {
      chapterNumber++;
      chNum = chapterNumber;
    }
    const record = wrapChapter({
      book: bookName,
      chapterNumber: chNum,
      title: titleFinal,
      sourcePath: src,
      sourceSha,
      recoveryItem: 'recovery-008',
      prose: c.content,
    });
    fs.writeFileSync(outPath, record);
    chapterRecords.push({ slug: c.slug, title: titleFinal, chapterNumber: chNum, path: outPath });
    logMove(src, outPath, `chunk-verified sha=${sourceSha.slice(0, 16)}`);
  }

  // Write CHAPTERS.book.slatl manifest
  const manifest = [];
  manifest.push(';; CHAPTERS.book.slatl');
  manifest.push(';; Book of Jesse — chapter manifest');
  manifest.push(`;; Generated ${RECOVERED_AT} by recovery-008`);
  manifest.push('');
  manifest.push('(book-manifest');
  manifest.push(`  :book "${bookName}"`);
  manifest.push(`  :chapter-count ${chapterRecords.length}`);
  manifest.push(`  :generated-at "${RECOVERED_AT}"`);
  manifest.push(`  :recovery-item "recovery-008"`);
  manifest.push(`  :source "${src}"`);
  manifest.push(`  :source-sha "${sourceSha}"`);
  manifest.push(`  :chapters (`);
  for (const r of chapterRecords) {
    manifest.push(`    (:number ${r.chapterNumber === null ? 'null' : r.chapterNumber} :slug "${r.slug}" :title "${escapeSlatString(r.title)}")`);
  }
  manifest.push('    ))');
  fs.writeFileSync(path.join(dst, 'CHAPTERS.book.slatl'), manifest.join('\n') + '\n');
  console.log(`  wrote ${chapterRecords.length} chapters + CHAPTERS.book.slatl to ${dst}`);
  return { count: chapterRecords.length, chapters: chapterRecords };
}

// --- recovery-009: Book of Scheme ramp-up ---------------------------

function chunkSchemeByHeading(sourcePath) {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const sourceSha = sha256(raw);
  const lines = raw.split('\n');
  const chunks = [];
  let current = { heading: null, contentLines: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) {
      if (current.contentLines.length > 0 || current.heading) chunks.push(current);
      current = { heading: line.replace(/^## /, '').trim(), contentLines: [line] };
    } else {
      current.contentLines.push(line);
    }
  }
  if (current.contentLines.length > 0 || current.heading) chunks.push(current);

  const named = [];
  const seen = new Set();
  let seq = 0;
  for (const c of chunks) {
    let slug;
    let title;
    if (c.heading === null) {
      slug = 'ch-rampup-00-cover';
      title = 'The Book of Scheme (Ramp-Up) — Cover';
    } else {
      title = c.heading;
      slug = slugifyScheme(c.heading, seq);
    }
    let s = slug;
    let dedupe = 2;
    while (seen.has(s)) { s = `${slug}-${dedupe}`; dedupe++; }
    seen.add(s);
    named.push({ slug: s, title, heading: c.heading, content: c.contentLines.join('\n') });
    seq++;
  }
  return { sourceSha, chunks: named, sourceRaw: raw };
}

function slugifyScheme(heading, seq) {
  const chMatch = heading.match(/^Chapter\s+([\d.]+)\s*[—-]\s*(.+)$/);
  if (chMatch) {
    const num = chMatch[1].padStart(2, '0');
    const slug = slugify(chMatch[2]);
    return `ch-rampup-${num}-${slug}`;
  }
  const appMatch = heading.match(/^Appendix(?:\s*[—-]\s*(.+))?$/);
  if (appMatch) {
    const tail = appMatch[1] ? slugify(appMatch[1]) : 'exercises';
    return `ch-rampup-appendix-${tail}`;
  }
  // Foreword or freeform
  return `ch-rampup-${String(seq).padStart(2, '0')}-${slugify(heading)}`;
}

function doRecovery009() {
  console.log('=== recovery-009: Book of Scheme (ramp-up) merge ===');
  const src = '/Users/alfred/code/scheme-lang/docs/BOOK-OF-SCHEME.md';
  const dst = '/Users/alfred/code/curator/scheme-books/book-of-scheme';
  ensureDir(dst);
  const { sourceSha, chunks, sourceRaw } = chunkSchemeByHeading(src);
  // Verify
  const rebuilt = chunks.map((c) => c.content).join('\n');
  const trimmedSrc = sourceRaw.endsWith('\n') ? sourceRaw.slice(0, -1) : sourceRaw;
  if (rebuilt !== trimmedSrc && rebuilt !== sourceRaw) {
    console.error('CONTENT-LOSS: rebuilt Scheme does not equal source');
    for (let i = 0; i < Math.min(rebuilt.length, sourceRaw.length); i++) {
      if (rebuilt[i] !== sourceRaw[i]) {
        console.error(`  first diff at char ${i}: rebuilt='${rebuilt.slice(i, i + 40)}' source='${sourceRaw.slice(i, i + 40)}'`);
        break;
      }
    }
    throw new Error('Scheme chunk verification failed');
  }
  console.log(`  verified: ${chunks.length} chunks concatenate to source exactly`);

  // Merge decision: canonical book-of-scheme already has 16 canonical chapters
  // (Hello / Values / Forms / Lists / Recursion / Records / Macros / Pattern /
  // Async / Errors / Modules / REPL / SLAT / Autogen / Sharing / Closing) plus
  // 10 appendices. The ramp-up MD covers similar topics but from a different
  // voice (onboarding-for-non-Scheme-programmers).
  // DECISION: keep ramp-up chapters as SEPARATE `ch-rampup-*` files at the tail
  // of book-of-scheme/, preserving both voices. No overwrites — different slug
  // prefixes guarantee no collisions with existing 01-hello-sakura-scheme etc.

  const bookName = 'Book of Scheme';
  const chapterRecords = [];
  // First, count existing canonical chapters to continue numbering.
  const existing = fs.readdirSync(dst).filter((f) => /^\d+-.+\.book\.slatl$/.test(f));
  // Existing max chapter number in canonical is 16 (per known state). We'll
  // number ramp-up starting after that but flag as a separate arc.
  let chapterNumber = 100; // arc-separated numbering, so ramp-up occupies 100+
  const arc = 'ramp-up';

  for (const c of chunks) {
    const outPath = path.join(dst, `${c.slug}.book.slatl`);
    if (fs.existsSync(outPath)) {
      // Never silently overwrite. Log divergence.
      const existingContent = fs.readFileSync(outPath, 'utf8');
      if (existingContent.includes(c.content.slice(0, 200))) {
        console.log(`  SKIP (already present): ${c.slug}`);
        continue;
      }
      // Divergence — write with `-recovered` suffix
      const altPath = path.join(dst, `${c.slug}-recovered-2026-07-14.book.slatl`);
      const record = wrapChapter({
        book: bookName, chapterNumber: null, title: c.title,
        sourcePath: src, sourceSha, recoveryItem: 'recovery-009',
        prose: c.content, arc, notes: `Divergent content — original at ${c.slug}.book.slatl preserved.`,
      });
      fs.writeFileSync(altPath, record);
      chapterRecords.push({ slug: `${c.slug}-recovered-2026-07-14`, title: c.title, chapterNumber: null, path: altPath, divergent: true });
      logMove(src, altPath, `divergence-preserved sha=${sourceSha.slice(0, 16)}`);
      continue;
    }
    let chNum = null;
    if (!c.slug.startsWith('ch-rampup-appendix') && c.slug !== 'ch-rampup-00-cover') {
      chapterNumber++;
      chNum = chapterNumber;
    } else if (c.slug === 'ch-rampup-00-cover') {
      chNum = 100;
    }
    const record = wrapChapter({
      book: bookName, chapterNumber: chNum, title: c.title,
      sourcePath: src, sourceSha, recoveryItem: 'recovery-009',
      prose: c.content, arc,
    });
    fs.writeFileSync(outPath, record);
    chapterRecords.push({ slug: c.slug, title: c.title, chapterNumber: chNum, path: outPath, divergent: false });
    logMove(src, outPath, `rampup-merge sha=${sourceSha.slice(0, 16)}`);
  }

  // Write a supplementary manifest describing the ramp-up arc.
  const manifestPath = path.join(dst, 'CHAPTERS-RAMPUP.book.slatl');
  const manifest = [];
  manifest.push(';; CHAPTERS-RAMPUP.book.slatl');
  manifest.push(';; Book of Scheme — Ramp-Up arc (recovery-009)');
  manifest.push(`;; Generated ${RECOVERED_AT}`);
  manifest.push('');
  manifest.push('(book-manifest');
  manifest.push(`  :book "${bookName}"`);
  manifest.push(`  :arc "${arc}"`);
  manifest.push(`  :chapter-count ${chapterRecords.length}`);
  manifest.push(`  :recovery-item "recovery-009"`);
  manifest.push(`  :source "${src}"`);
  manifest.push(`  :source-sha "${sourceSha}"`);
  manifest.push(`  :merge-decision "Ramp-up voice preserved as separate ch-rampup-* chapters at tail of book-of-scheme/; canonical 16 chapters + 10 appendices untouched. Voices differ (onboarding-for-non-Scheme vs shipped canonical); both provide complementary teaching angles on shared topics (Values, Special Forms, Lists, Recursion, Macros, Modules, Errors)."`);
  manifest.push(`  :chapters (`);
  for (const r of chapterRecords) {
    manifest.push(`    (:number ${r.chapterNumber === null ? 'null' : r.chapterNumber} :slug "${r.slug}" :title "${escapeSlatString(r.title)}"${r.divergent ? ' :divergent true' : ''})`);
  }
  manifest.push('    ))');
  fs.writeFileSync(manifestPath, manifest.join('\n') + '\n');
  console.log(`  wrote ${chapterRecords.length} ramp-up chapters + CHAPTERS-RAMPUP.book.slatl to ${dst}`);
  return { count: chapterRecords.length, chapters: chapterRecords };
}

// --- recovery-010: Book of Reason Code ------------------------------

function doRecovery010() {
  console.log('=== recovery-010: Book of Reason Code (standalone, 4 chapters) ===');
  const srcDir = '/Users/alfred/code/curator/BOOK/B-main-scheme-books/scheme-books/reason-code';
  const dst = '/Users/alfred/code/curator/scheme-books/book-of-reason-code';
  ensureDir(dst);
  const renameMap = [
    ['00-cover.md', '00-cover.book.slatl', 0, 'Cover'],
    ['01-signals-and-symbols.md', '01-signals-and-symbols.book.slatl', 1, 'Signals and Symbols'],
    ['02-machines-that-think.md', '02-machines-that-think.book.slatl', 2, 'Machines That Think'],
    ['03-from-machines-to-minds.md', '03-from-machines-to-minds.book.slatl', 3, 'From Machines to Minds'],
  ];
  const bookName = 'Book of Reason Code';
  const chapterRecords = [];
  for (const [srcName, dstName, chNum, title] of renameMap) {
    const srcPath = path.join(srcDir, srcName);
    const dstPath = path.join(dst, dstName);
    const content = fs.readFileSync(srcPath, 'utf8');
    const srcSha = sha256(content);
    const record = wrapChapter({
      book: bookName, chapterNumber: chNum, title,
      sourcePath: srcPath, sourceSha: srcSha, recoveryItem: 'recovery-010',
      prose: content,
    });
    fs.writeFileSync(dstPath, record);
    chapterRecords.push({ slug: dstName.replace('.book.slatl', ''), title, chapterNumber: chNum, path: dstPath });
    logMove(srcPath, dstPath, `direct-wrap sha=${srcSha.slice(0, 16)}`);
  }
  // Preserve any source CHAPTERS.slatl by copying it as an archive companion
  const srcChaptersSlatl = path.join(srcDir, 'CHAPTERS.slatl');
  if (fs.existsSync(srcChaptersSlatl)) {
    const arcContent = fs.readFileSync(srcChaptersSlatl, 'utf8');
    const arcSha = sha256(arcContent);
    const arcPath = path.join(dst, 'CHAPTERS-source-archive.slatl');
    fs.writeFileSync(arcPath, `;; Preserved source CHAPTERS.slatl from ${srcChaptersSlatl}\n;; recovered ${RECOVERED_AT} recovery-010\n;; sha256: ${arcSha}\n\n${arcContent}`);
    logMove(srcChaptersSlatl, arcPath, `archive-copy sha=${arcSha.slice(0, 16)}`);
  }
  // Write CHAPTERS.book.slatl manifest
  const manifest = [];
  manifest.push(';; CHAPTERS.book.slatl');
  manifest.push(';; Book of Reason Code — chapter manifest');
  manifest.push(`;; Generated ${RECOVERED_AT} by recovery-010`);
  manifest.push('');
  manifest.push('(book-manifest');
  manifest.push(`  :book "${bookName}"`);
  manifest.push(`  :chapter-count ${chapterRecords.length}`);
  manifest.push(`  :generated-at "${RECOVERED_AT}"`);
  manifest.push(`  :recovery-item "recovery-010"`);
  manifest.push(`  :chapters (`);
  for (const r of chapterRecords) {
    manifest.push(`    (:number ${r.chapterNumber === null ? 'null' : r.chapterNumber} :slug "${r.slug}" :title "${escapeSlatString(r.title)}")`);
  }
  manifest.push('    ))');
  fs.writeFileSync(path.join(dst, 'CHAPTERS.book.slatl'), manifest.join('\n') + '\n');
  console.log(`  wrote ${chapterRecords.length} chapters + CHAPTERS.book.slatl to ${dst}`);
  return { count: chapterRecords.length, chapters: chapterRecords };
}

// --- recovery-011: Book Extensions (9 named appendices) -------------

function doRecovery011() {
  console.log('=== recovery-011: Book of Extensions (9 appendices + HANDOFF) ===');
  const srcDir = '/Users/alfred/code/curator/BOOK/A-branch-scheme-books/book-extensions';
  const dst = '/Users/alfred/code/curator/scheme-books/book-of-extensions';
  ensureDir(dst);
  const renameMap = [
    ['book-ext-a-register-discrimination.md', '01-register-discrimination.book.slatl', 1, 'Register Discrimination'],
    ['book-ext-b-named-antipatterns.md', '02-named-antipatterns.book.slatl', 2, 'Named Antipatterns'],
    ['book-ext-c-associative-cs-lore.md', '03-associative-cs-lore.book.slatl', 3, 'Associative CS Lore'],
    ['book-ext-d-ramp-appendixes.md', '04-ramp-appendixes.book.slatl', 4, 'Ramp Appendixes'],
    ['book-ext-e-library-extensions-shop-verbs.md', '05-library-extensions-shop-verbs.book.slatl', 5, 'Library Extensions — Shop Verbs'],
    ['book-ext-f-kit-and-seed-generation.md', '06-kit-and-seed-generation.book.slatl', 6, 'Kit and Seed Generation'],
    ['book-ext-g-deadpan-reality-check.md', '07-deadpan-reality-check.book.slatl', 7, 'Deadpan Reality Check'],
    ['book-ext-h-determinism-vs-voice-words-coupling.md', '08-determinism-vs-voice.book.slatl', 8, 'Determinism vs Voice — Words Coupling'],
    ['book-ext-i-scalar-axes-cost-consent.md', '09-scalar-axes-cost-consent.book.slatl', 9, 'Scalar Axes — Cost + Consent'],
  ];
  const bookName = 'Book of Extensions';
  const chapterRecords = [];
  for (const [srcName, dstName, chNum, title] of renameMap) {
    const srcPath = path.join(srcDir, srcName);
    const dstPath = path.join(dst, dstName);
    const content = fs.readFileSync(srcPath, 'utf8');
    const srcSha = sha256(content);
    const record = wrapChapter({
      book: bookName, chapterNumber: chNum, title,
      sourcePath: srcPath, sourceSha: srcSha, recoveryItem: 'recovery-011',
      prose: content,
    });
    fs.writeFileSync(dstPath, record);
    chapterRecords.push({ slug: dstName.replace('.book.slatl', ''), title, chapterNumber: chNum, path: dstPath });
    logMove(srcPath, dstPath, `rename-and-wrap sha=${srcSha.slice(0, 16)}`);
  }
  // HANDOFF.md → ARCHIVE-HANDOFF.md (copy, no wrap — this is meta/handoff)
  const handoffSrc = path.join(srcDir, 'book-ext-HANDOFF.md');
  if (fs.existsSync(handoffSrc)) {
    const handoffContent = fs.readFileSync(handoffSrc, 'utf8');
    const handoffSha = sha256(handoffContent);
    const handoffDst = path.join(dst, 'ARCHIVE-HANDOFF.md');
    const preserved = `<!-- Preserved from ${handoffSrc}\n     recovered ${RECOVERED_AT} recovery-011\n     sha256: ${handoffSha}\n-->\n\n${handoffContent}`;
    fs.writeFileSync(handoffDst, preserved);
    logMove(handoffSrc, handoffDst, `handoff-preserve sha=${handoffSha.slice(0, 16)}`);
    console.log(`  preserved HANDOFF as ARCHIVE-HANDOFF.md`);
  }
  // Write CHAPTERS.book.slatl
  const manifest = [];
  manifest.push(';; CHAPTERS.book.slatl');
  manifest.push(';; Book of Extensions — chapter manifest');
  manifest.push(`;; Generated ${RECOVERED_AT} by recovery-011`);
  manifest.push('');
  manifest.push('(book-manifest');
  manifest.push(`  :book "${bookName}"`);
  manifest.push(`  :chapter-count ${chapterRecords.length}`);
  manifest.push(`  :generated-at "${RECOVERED_AT}"`);
  manifest.push(`  :recovery-item "recovery-011"`);
  manifest.push(`  :chapters (`);
  for (const r of chapterRecords) {
    manifest.push(`    (:number ${r.chapterNumber} :slug "${r.slug}" :title "${escapeSlatString(r.title)}")`);
  }
  manifest.push('    ))');
  fs.writeFileSync(path.join(dst, 'CHAPTERS.book.slatl'), manifest.join('\n') + '\n');
  console.log(`  wrote ${chapterRecords.length} chapters + CHAPTERS.book.slatl to ${dst}`);
  return { count: chapterRecords.length, chapters: chapterRecords };
}

// --- Main ------------------------------------------------------------

const results = {};
results['recovery-008'] = doRecovery008();
results['recovery-009'] = doRecovery009();
results['recovery-010'] = doRecovery010();
results['recovery-011'] = doRecovery011();

writeLog();

// Report
const report = [];
report.push(';; Recovery Lane 2 — Misfiled Books — Final Report');
report.push(`;; Generated ${RECOVERED_AT}`);
report.push(';; Lane: Recovery Lane 2 (Misfiled Books)');
report.push(';; Items executed: recovery-008, recovery-009, recovery-010, recovery-011');
report.push('');
for (const [item, r] of Object.entries(results)) {
  report.push(`(item :id "${item}" :chapters ${r.count}`);
  report.push(`  :chapter-list (`);
  for (const c of r.chapters) {
    report.push(`    (:number ${c.chapterNumber === null ? 'null' : c.chapterNumber} :slug "${c.slug}" :title "${escapeSlatString(c.title)}")`);
  }
  report.push('    ))');
}
report.push('');
report.push(';; Moves logged: ' + moves.length);
report.push(`;; Log path: ${LOG_PATH}`);
ensureDir(path.dirname(REPORT_PATH));
fs.writeFileSync(REPORT_PATH, report.join('\n') + '\n');
console.log(`\nDONE. Report: ${REPORT_PATH}`);
console.log(`Log: ${LOG_PATH}`);
console.log(`Total moves logged: ${moves.length}`);
console.log(`Chapter counts: 008=${results['recovery-008'].count} 009=${results['recovery-009'].count} 010=${results['recovery-010'].count} 011=${results['recovery-011'].count}`);
