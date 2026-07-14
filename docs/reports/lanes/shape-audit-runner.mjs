#!/usr/bin/env node
// Shape audit: parse SLAT reference, classify each verb by Sakura-shape adherence.
import fs from 'node:fs';

const SRC = '/Users/alfred/code/scheme-lang/docs/SAKURA-SCHEME-REFERENCE.slat';
const OUT = '/Users/alfred/code/scheme-lang/docs/reports/sakura-shape-audit-2026-07-14.slat';

const text = fs.readFileSync(SRC, 'utf8');

function tractRecords(source, head) {
  const records = [];
  const re = new RegExp('^\\(' + head + '\\b', 'mg');
  let m;
  while ((m = re[Symbol.match].bind(re) ? null : null) === null) {
    m = re.test(source) ? null : null;
    break;
  }
  // Use matchAll
  const iter = source.matchAll(re);
  for (const mm of iter) {
    const start = mm.index;
    let i = start;
    let depth = 0;
    let inStr = false;
    let esc = false;
    while (i < source.length) {
      const c = source[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) {
            records.push({ start, end: i + 1, text: source.slice(start, i + 1) });
            break;
          }
        }
      }
      i++;
    }
  }
  return records;
}

function fieldOf(recText, key) {
  const re = new RegExp(':' + key + '\\s');
  const m = recText.match(re);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < recText.length && /\s/.test(recText[i])) i++;
  if (i >= recText.length) return null;
  const c = recText[i];
  if (c === '"') {
    let j = i + 1;
    let esc = false;
    while (j < recText.length) {
      if (esc) esc = false;
      else if (recText[j] === '\\') esc = true;
      else if (recText[j] === '"') { j++; break; }
      j++;
    }
    return { raw: recText.slice(i, j), value: recText.slice(i + 1, j - 1) };
  } else if (c === '(') {
    let j = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    while (j < recText.length) {
      const ch = recText[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      j++;
    }
    return { raw: recText.slice(i, j), value: recText.slice(i, j) };
  } else {
    let j = i;
    while (j < recText.length && !/[\s\)]/.test(recText[j])) j++;
    return { raw: recText.slice(i, j), value: recText.slice(i, j) };
  }
}

function unpackExamples(examplesRaw) {
  if (!examplesRaw) return [];
  const inner = examplesRaw.slice(1, -1);
  const examples = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i++;
    if (i >= inner.length) break;
    if (inner[i] !== '(') { i++; continue; }
    let j = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    while (j < inner.length) {
      const ch = inner[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      j++;
    }
    const subRec = inner.slice(i, j);
    const tierM = subRec.match(/:tier\s+"([^"]*)"/);
    const codeM = subRec.match(/:code\s+"((?:[^"\\]|\\.)*)"/s);
    examples.push({
      tier: tierM ? tierM[1] : '',
      code: codeM ? codeM[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '',
      raw: subRec,
    });
    i = j;
  }
  return examples;
}

const verbRecords = tractRecords(text, 'verb');
console.error(`Found ${verbRecords.length} verb records`);

const CONSOLE_LEGIT_LIBS = new Set(['input']);

const CONSOLE_LEGIT_VERB_PATTERNS = [
  /^spr\b/, /^sspr\b/, /^pal\b/, /^palt\b/, /^camera\b/, /^clip\b/,
  /^pset\b/, /^pget\b/, /^btn\b/, /^btnp\b/, /^sfx\b/, /^music\b/,
  /^map\b/, /^mget\b/, /^mset\b/, /^fget\b/, /^fset\b/,
  /^cls\b/, /^rect\b/, /^rectfill\b/, /^circ\b/, /^circfill\b/,
  /^line\b/, /^print\b/, /^cursor\b/, /^color\b/, /^stat\b/,
  /^peek\b/, /^poke\b/, /^flr\b/, /^ceil\b/, /^abs\b/,
  /^sin\b/, /^cos\b/, /^atan2\b/, /^sqrt\b/, /^rnd\b/, /^srand\b/,
];

const SAKURA_WORLD_LIBS = new Set([
  'card', 'shoppe', 'cine', 'radio', 'scene', 'flower', 'motion',
  'animation', 'artifact', 'weather', 'floor', 'surface',
]);

const R7RS_VIOLATIONS = [
  { pattern: /\bfuncall\b/, kind: 'lisp-2-funcall' },
  { pattern: /\bcall\/cc\b/, kind: 'call-cc-forbidden' },
  { pattern: /\bcall-with-current-continuation\b/, kind: 'call-cc-forbidden' },
  { pattern: /\(eval\s/, kind: 'eval-forbidden' },
  { pattern: /\bdefmacro\b/, kind: 'non-r7rs-macro' },
  { pattern: /\bdefun\b/, kind: 'common-lisp-defun' },
  { pattern: /\bsetf\b/, kind: 'common-lisp-setf' },
  { pattern: /\bsetq\b/, kind: 'common-lisp-setq' },
  { pattern: /#\'/, kind: 'lisp-2-function-quote' },
];

const CONSOLE_LEAK_MARKERS = [
  /\(spr\s+\d/, /\(pal\s+\d/, /\(palt\s+\d/,
  /\(cls\)/, /\(cls\s+\d/,
  /\(rectfill\s/, /\(circfill\s/,
  /\(sfx\s+\d/, /\(music\s+\d/,
  /\(btn\s+\d/, /\(btnp\s+\d/,
  /\(pset\s/, /\(pget\s/,
  /\(camera\s+\d/,
];

let counts = {
  total: 0,
  sakuraShaped: 0,
  consoleLegit: 0,
  consoleLeaking: 0,
  r7rsViolations: 0,
  intentClearStub: 0,
  intentUnclear: 0,
};

const findings = [];

for (const rec of verbRecords) {
  counts.total++;
  const nameF = fieldOf(rec.text, 'name');
  const libF = fieldOf(rec.text, 'library');
  const summaryF = fieldOf(rec.text, 'summary');
  const explanationF = fieldOf(rec.text, 'explanation');
  const examplesF = fieldOf(rec.text, 'examples');

  if (!nameF) continue;
  const name = nameF.value;
  const library = libF ? libF.value : '';
  const summary = summaryF ? summaryF.value : '';
  const explanation = explanationF ? explanationF.value : '';
  const examples = examplesF ? unpackExamples(examplesF.value) : [];

  const isConsoleLegitLib = CONSOLE_LEGIT_LIBS.has(library);
  // Only treat as console-legit-verb if the verb has NO slash (bare fantasy-console name).
  // Namespaced verbs like stat/mean, geom/tan, plot/line, calc/abs are library verbs, NOT console.
  const isConsoleLegitVerb = !name.includes('/') && CONSOLE_LEGIT_VERB_PATTERNS.some(rx => rx.test(name));
  const isSakuraWorldLib = SAKURA_WORLD_LIBS.has(library);

  const issues = [];
  const exampleFlags = [];

  examples.forEach((ex, idx) => {
    const code = ex.code;
    const consoleLeaks = CONSOLE_LEAK_MARKERS.filter(rx => rx.test(code));
    const r7Violations = R7RS_VIOLATIONS.filter(v => v.pattern.test(code));
    exampleFlags.push({
      idx, tier: ex.tier,
      consoleLeaks: consoleLeaks.length,
      r7Violations: r7Violations.map(v => v.kind),
    });
    if (r7Violations.length > 0) {
      r7Violations.forEach(v => issues.push(`example-${idx + 1}-${v.kind}`));
    }
    if (consoleLeaks.length > 0 && !isConsoleLegitLib && !isConsoleLegitVerb) {
      issues.push(`example-${idx + 1}-console-leak`);
    }
  });

  let explanationConsoleLeak = false;
  if (!isConsoleLegitLib && !isConsoleLegitVerb) {
    const explLeaks = /pico-?8|palette-flip|sprite-index|pixel-index|framebuffer\s+bank/i.test(explanation);
    if (explLeaks) {
      explanationConsoleLeak = true;
      issues.push('explanation-console-idiom');
    }
  }

  const hasIntent = (summary && summary.trim().length > 10) || (explanation && explanation.trim().length > 20);
  const impIsStub = summary && (
    /\b(stub|not yet|todo|placeholder|nyi|unimplemented)\b/i.test(summary + ' ' + explanation)
  );

  let verdict = 'sakura-shaped';
  let recommendation = 'keep';

  const anyExampleConsoleLeak = exampleFlags.some(f => f.consoleLeaks > 0);
  const anyExampleR7 = exampleFlags.some(f => f.r7Violations.length > 0);

  if (!hasIntent) {
    verdict = 'intent-unclear';
    recommendation = 'ask-alfred';
    counts.intentUnclear++;
  } else if (anyExampleR7) {
    verdict = 'r7rs-violation';
    const violIdx = exampleFlags.filter(f => f.r7Violations.length > 0).map(f => f.idx + 1);
    recommendation = `reshape-example-${violIdx.join(',')}`;
    counts.r7rsViolations++;
  } else if (anyExampleConsoleLeak && !isConsoleLegitLib && !isConsoleLegitVerb) {
    verdict = 'console-shape-leaking';
    const leakIdx = exampleFlags.filter(f => f.consoleLeaks > 0).map(f => f.idx + 1);
    recommendation = `reshape-example-${leakIdx.join(',')}`;
    counts.consoleLeaking++;
  } else if (isConsoleLegitLib || isConsoleLegitVerb) {
    verdict = 'console-shape-legit';
    recommendation = 'keep';
    counts.consoleLegit++;
  } else if (impIsStub) {
    verdict = 'sakura-shaped';
    recommendation = 'keep';
    counts.intentClearStub++;
    counts.sakuraShaped++;
  } else {
    verdict = 'sakura-shaped';
    recommendation = 'keep';
    counts.sakuraShaped++;
  }

  if (explanationConsoleLeak && verdict === 'sakura-shaped') {
    verdict = 'console-shape-leaking';
    recommendation = 'rewrite-explanation';
    counts.sakuraShaped--;
    counts.consoleLeaking++;
  }

  findings.push({
    name, library, verdict, issues, recommendation,
    isSakuraWorldLib, isConsoleLegit: isConsoleLegitLib || isConsoleLegitVerb,
    exampleFlags,
  });
}

const out = [];
out.push('; Sakura Shape Audit — 2026-07-14');
out.push('; Automated per-verb classification against Sakura-shape doctrine.');
out.push('; Reviewer: shape-audit-lane (script-driven, heuristic).');
out.push(';');
out.push('; Verdict legend:');
out.push(';   sakura-shaped         — examples fit Sakura world; keep as-is');
out.push(';   console-shape-legit   — fantasy-console verb, console-shape is CORRECT');
out.push(';   console-shape-leaking — non-console verb whose examples leaked console idioms; RESHAPE');
out.push(';   r7rs-violation        — example uses non-R7RS forms (funcall/call-cc/defmacro/etc)');
out.push(';   intent-unclear        — name+args do not clarify intent; ASK ALFRED');
out.push('');
out.push('(shape-audit');
out.push('  :date "2026-07-14"');
out.push('  :reviewer "shape-audit-lane"');
out.push(`  :total-verbs-audited ${counts.total}`);
out.push(`  :fully-sakura-shaped ${counts.sakuraShaped}`);
out.push(`  :console-shape-legit ${counts.consoleLegit}`);
out.push(`  :console-shape-leaking ${counts.consoleLeaking}`);
out.push(`  :r7rs-violations ${counts.r7rsViolations}`);
out.push(`  :intent-clear-impl-stub ${counts.intentClearStub}`);
out.push(`  :intent-unclear ${counts.intentUnclear}`);
out.push(')');
out.push('');

for (const f of findings) {
  const issuesStr = f.issues.length === 0 ? '()' : `(${f.issues.map(i => `"${i}"`).join(' ')})`;
  out.push('(finding');
  out.push(`  :verb "${f.name}"`);
  out.push(`  :namespace "${f.library}"`);
  out.push(`  :verdict "${f.verdict}"`);
  out.push(`  :issues ${issuesStr}`);
  out.push(`  :recommendation "${f.recommendation}"`);
  out.push(')');
  out.push('');
}

fs.writeFileSync(OUT, out.join('\n'));

console.error(JSON.stringify(counts, null, 2));

const leakingSakuraWorld = findings.filter(f => f.verdict === 'console-shape-leaking' && f.isSakuraWorldLib);
const leakingOther = findings.filter(f => f.verdict === 'console-shape-leaking' && !f.isSakuraWorldLib);
console.error('\nTOP CONSOLE-LEAK (into Sakura-world libs):');
leakingSakuraWorld.slice(0, 20).forEach(f => console.error(`  ${f.name} [${f.library}]: ${f.issues.join(', ')}`));
console.error('\nTOP CONSOLE-LEAK (other libs):');
leakingOther.slice(0, 20).forEach(f => console.error(`  ${f.name} [${f.library}]: ${f.issues.join(', ')}`));

const unclear = findings.filter(f => f.verdict === 'intent-unclear');
console.error(`\nINTENT-UNCLEAR (${unclear.length}):`);
unclear.slice(0, 40).forEach(f => console.error(`  ${f.name} [${f.library}]`));

const r7 = findings.filter(f => f.verdict === 'r7rs-violation');
console.error(`\nR7RS-VIOLATION (${r7.length}):`);
r7.slice(0, 30).forEach(f => console.error(`  ${f.name} [${f.library}]: ${f.issues.join(', ')}`));

const byLib = {};
for (const f of findings) {
  if (!byLib[f.library]) byLib[f.library] = { total: 0, leak: 0, r7: 0, unclear: 0, legit: 0, sakura: 0 };
  byLib[f.library].total++;
  if (f.verdict === 'console-shape-leaking') byLib[f.library].leak++;
  else if (f.verdict === 'r7rs-violation') byLib[f.library].r7++;
  else if (f.verdict === 'intent-unclear') byLib[f.library].unclear++;
  else if (f.verdict === 'console-shape-legit') byLib[f.library].legit++;
  else byLib[f.library].sakura++;
}
console.error('\nLIBRARY BREAKDOWN:');
Object.entries(byLib).sort((a,b) => b[1].leak - a[1].leak).forEach(([lib, s]) => {
  console.error(`  ${lib.padEnd(20)} total=${s.total} sakura=${s.sakura} legit=${s.legit} leak=${s.leak} r7=${s.r7} unclear=${s.unclear}`);
});
