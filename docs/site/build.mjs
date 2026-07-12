#!/usr/bin/env node
// docs/site/build.mjs — hand-rolled ES-module bundler for the browser.
//
// No npm deps (we deliberately avoid pulling esbuild or rollup — the core
// engine is six pure-JS files with no cross-file cycles, and concatenating
// them in dependency order is a small task well within our reach).
//
// Output:
//   docs/site/dist/scheme-lang.mjs   — the bundled interpreter + reader
//                                       + macro expander + base env.
//
// The bundled module exports:
//   parse, tokenize, Sym, sym          (from reader)
//   evaluate, apply, Env, Closure      (from interp)
//   expandProgram                      (from macro)
//   makeBaseEnv                        (from base)
//   setAdapters, getAdapters           (from adapters)
//   registerVerbMeta, defaultMetaFor,
//   validateRegistry, VERB_META        (from registry)
//   CORE_DOCS                          (from repl/verbInfo — hand-lifted)
//
// The bundle does NOT include repl/*, launcher/*, or anything that touches
// node: modules. The browser REPL widget wraps the bundled engine with a
// browser-native line editor, completion, and highlight layer.
//
// Approach: read each source file, strip its `import` and `export` lines,
// wrap the file in `// ── FILE: <path> ─────────────` header, and prepend
// a `// bundled from src/…` comment block at the top of the output.
// Concatenation order is dependency-topologically-sorted.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SRC = join(REPO_ROOT, 'src')
const OUT = join(__dirname, 'dist')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

// Dependency order (topological). reader has no deps; interp needs reader
// + registry; macro needs reader; adapters is standalone; base needs
// interp + reader + adapters.
const ORDER = [
  'src/reader.js',
  'src/registry.js',
  'src/adapters.js',
  'src/interp.js',
  'src/macro.js',
  'src/base.js',
]

// Every export we want to re-expose at the bundle boundary.
const EXPORTS = [
  // reader
  'Sym', 'sym', 'parse', 'tokenize', 'posOf', 'tagPos', 'clearParseCache', 'parseCacheStats', 'ReadError',
  // registry
  'registerVerbMeta', 'defaultMetaFor', 'validateRegistry', 'getVerbMeta', 'hasVerb', 'snapshotRegistry',
  // adapters
  'setAdapters', 'getAdapters',
  // interp
  'evaluate', 'apply', 'Env', 'Closure',
  // macro
  'expandProgram', 'expandTop', 'MacroTable',
  // base
  'makeBaseEnv',
]

function readFile(rel) {
  return readFileSync(join(REPO_ROOT, rel), 'utf-8')
}

// Line-based strip pass. Each source file is a small hand-written module
// with a predictable shape — top-of-file imports, then a series of
// `export function/class/const` declarations, occasionally a bottom
// `export default { … }` object literal. We walk the file line-by-line
// and (a) drop imports, (b) rewrite `export ` prefixes, (c) drop
// `export default { … }` and `export { … }` blocks by counting braces.
function stripImportsAndExports(src) {
  const lines = src.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Import: single line or multi-line { … } from '…'
    if (/^\s*import\b/.test(line)) {
      // Consume until the line ends with a closing brace + from '...' or
      // the line itself already has the full form.
      if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(line)) { i++; continue }
      // Multi-line — consume until we hit the terminating `from '…'`.
      while (i < lines.length && !/from\s+['"][^'"]+['"]\s*;?\s*$/.test(lines[i])) i++
      i++ // consume the closing line
      continue
    }
    // Export default { … } — brace-count until close.
    if (/^\s*export\s+default\s*\{/.test(line)) {
      let depth = 0
      // Count braces on this line to seed depth.
      for (const c of line) { if (c === '{') depth++; else if (c === '}') depth-- }
      i++
      while (i < lines.length && depth > 0) {
        for (const c of lines[i]) { if (c === '{') depth++; else if (c === '}') depth-- }
        i++
      }
      continue
    }
    // Export { … } — brace-count.
    if (/^\s*export\s*\{/.test(line)) {
      let depth = 0
      for (const c of line) { if (c === '{') depth++; else if (c === '}') depth-- }
      i++
      while (i < lines.length && depth > 0) {
        for (const c of lines[i]) { if (c === '{') depth++; else if (c === '}') depth-- }
        i++
      }
      continue
    }
    // Export default <expr>; — line-level drop of default keyword.
    if (/^\s*export\s+default\s+/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+default\s+/, '$1'))
      i++
      continue
    }
    // Export function/class/const/let/var/async — strip the prefix.
    if (/^\s*export\s+(class|function|const|let|var|async\s+function)\b/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+/, '$1'))
      i++
      continue
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

const HEADER = `// scheme-lang browser bundle — auto-generated by docs/site/build.mjs
// Concatenated from ${ORDER.map(f => f.replace('src/', '')).join(', ')}
// The core engine has zero Node built-in deps; this bundle is directly
// loadable as an ES module in any modern browser.
//
// Regenerate with:  node docs/site/build.mjs
// Do not edit by hand — changes will be overwritten on the next build.

/* eslint-disable */
`

const chunks = [HEADER]
for (const rel of ORDER) {
  const src = readFile(rel)
  const stripped = stripImportsAndExports(src)
  chunks.push(`\n// ── ${rel} ──────────────────────────────────\n`)
  chunks.push(stripped)
}

// Lift the CORE_DOCS from repl/verbInfo — it's a plain object literal,
// no node deps, useful for the browser widget's ,help + tab-complete.
// We do a regex extraction so we're not tempted to also drag in `Sym`
// which repl/verbInfo imports.
const verbInfoSrc = readFile('src/repl/verbInfo.js')
const coreDocsMatch = verbInfoSrc.match(/(?:export )?const CORE_DOCS = Object\.freeze\(\{[\s\S]*?\}\)/)
if (coreDocsMatch) {
  chunks.push('\n// ── src/repl/verbInfo.js (CORE_DOCS only) ─────────\n')
  chunks.push('const ' + coreDocsMatch[0].replace(/^(?:export )?const /, '') + '\n')
}

// Explicit export list at the bottom.
chunks.push('\n// ── exports ────────────────────────────────────\n')
chunks.push('export {\n')
for (const name of EXPORTS) {
  chunks.push(`  ${name},\n`)
}
if (coreDocsMatch) chunks.push('  CORE_DOCS,\n')
chunks.push('}\n')

const output = chunks.join('')
const outPath = join(OUT, 'scheme-lang.mjs')
writeFileSync(outPath, output, 'utf-8')

// Report.
const sizeKB = (output.length / 1024).toFixed(1)
process.stdout.write(`built ${outPath}\n  ${output.length} bytes  (${sizeKB} KB)\n`)
process.stdout.write(`  ${ORDER.length + (coreDocsMatch ? 1 : 0)} source files bundled\n`)
process.stdout.write(`  ${EXPORTS.length + (coreDocsMatch ? 1 : 0)} names exported\n`)
