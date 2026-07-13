// banner.js — the pink cherry-blossom banner for the Sakura dialect.
//
// Fits in a phone terminal (~9 rows wide). Flower on the left, tight info
// column on the right: dialect + version, lang version, node version,
// help hints. No animation, no gradient.

import { role, PALETTE, fg, dim } from './palette.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read the language version once. Falls back if the file's missing.
function readLangVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))
    if (pkg && pkg.version) return pkg.version
  } catch (_) {}
  try {
    const dialect = JSON.parse(readFileSync(join(__dirname, '../../dialect.json'), 'utf-8'))
    if (dialect && dialect.version) return dialect.version
  } catch (_) {}
  return '1.0'
}

const LANG_VERSION = readLangVersion()

// Compact blossom — 6 rows, ~14 columns wide. Renders on a phone.
const BLOSSOM_LINES = [
  '',
  '  ' + fg(PALETTE.petal, '✿') + ' ' + fg(PALETTE.bloom, '✿') + ' ' + fg(PALETTE.blush, '·'),
  '  ' + fg(PALETTE.bloom, '✿') + ' ' + fg(PALETTE.petal, '✿') + ' ' + fg(PALETTE.bloom, '✿'),
  '  ' + fg(PALETTE.blush, '·') + ' ' + fg(PALETTE.petal, '✿') + ' ' + fg(PALETTE.blush, '·'),
  '     ' + fg(PALETTE.moss, '│'),
  '   ' + fg(PALETTE.sage, '~~~~~'),
  '',
]

/**
 * sakuraBanner({ version, tagline }) → array of strings
 *
 * Right column is tight so the whole banner fits under ~44 columns —
 * comfortable on a phone terminal.
 */
export function sakuraBanner({ version = '1.0', tagline } = {}) {
  const nodeMajor = (process.versions && process.versions.node)
    ? process.versions.node.split('.')[0]
    : '?'
  const rightLines = [
    '',
    role.strong('Sakura Scheme') + role.dim(`  v${version}`),
    role.dim('scheme-lang ') + role.text(LANG_VERSION) + role.dim('  ·  node ') + role.text(nodeMajor),
    tagline ? role.dim(tagline) : role.dim('a language for humans and AI'),
    '',
    role.dim(',help') + role.dim('  ·  ') + role.dim(',ask sakura') + role.dim('  ·  ') + role.dim(',exit'),
    '',
  ]

  const out = []
  const width = BLOSSOM_LINES.length
  for (let i = 0; i < width; i++) {
    const left  = BLOSSOM_LINES[i] || ''
    const right = rightLines[i] || ''
    // Left column is fixed 14 visible chars; ANSI escapes don't count
    out.push(left.padEnd(10 + (left.length - visibleLength(left))) + ' ' + right)
  }
  return out
}

// Rough visible-length of a string with ANSI escapes — subtract the
// escape bytes so padEnd targets the visible-column width.
// Also account for ✿ which most modern terminals render as double-width.
function visibleLength(s) {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '')
  const wide = (stripped.match(/✿/g) || []).length
  return stripped.length + wide
}

/**
 * neutralBanner() — for `scheme-lang` with a non-Sakura dialect.
 * Same shape as the Sakura banner, minus the flower.
 */
export function neutralBanner({ name, version, tagline }) {
  const nodeMajor = (process.versions && process.versions.node)
    ? process.versions.node.split('.')[0]
    : '?'
  return [
    '',
    role.section(name) + role.dim(`  v${version || '0'}`),
    role.dim('scheme-lang ') + role.text(LANG_VERSION) + role.dim('  ·  node ') + role.text(nodeMajor),
    tagline ? role.dim(tagline) : '',
    role.dim(',help') + role.dim('  ·  ') + role.dim(',exit'),
    '',
  ]
}

/**
 * printBanner(lines, out=process.stdout)
 */
export function printBanner(lines, out = process.stdout) {
  for (const l of lines) out.write(l + '\n')
}

// Exposed for tests / diagnostics.
export const SCHEME_LANG_VERSION = LANG_VERSION
