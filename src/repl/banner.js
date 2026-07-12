// banner.js — the pink cherry-blossom banner for the Sakura dialect.
//
// clean: solid pink, muted green stem, cream text. No animation,
// no gradient, no frame. Fits in ~10 rows so it doesn't dominate the
// terminal on first launch.
//
// The exact shape is loosely a blossom cluster + a small stem line —
// deliberately not overwrought. Alfred's directive: warm, unmistakable,
// not clinical. Solid.

import { role, PALETTE, fg, dim } from './palette.js'

const BLOSSOM_LINES = [
  //           deeper  main  pale
  //            ✿      ✿    ✿
  '',
  '           ' + fg(PALETTE.blush, '·') + '  ' + fg(PALETTE.petal, '✿') + '   ' + fg(PALETTE.bloom, '✿') + '  ' + fg(PALETTE.blush, '·'),
  '        ' + fg(PALETTE.petal, '✿') + '   ' + fg(PALETTE.bloom, '✿') + '   ' + fg(PALETTE.petal, '✿') + '   ' + fg(PALETTE.blush, '·'),
  '           ' + fg(PALETTE.bloom, '✿') + '   ' + fg(PALETTE.petal, '✿') + '   ' + fg(PALETTE.bloom, '✿'),
  '        ' + fg(PALETTE.blush, '·') + '   ' + fg(PALETTE.petal, '✿') + '   ' + fg(PALETTE.bloom, '✿') + '   ' + fg(PALETTE.blush, '·'),
  '                 ' + fg(PALETTE.moss, '│'),
  '               ' + fg(PALETTE.sage, '~~~~~'),
  '',
]

/**
 * bannerLines({ name, version, tagline }) → array of strings
 *
 * Returns the flower + right-side text as an array of composed lines
 * ready to write to stdout. Text is aligned to the right of the flower.
 */
export function sakuraBanner({ version = '1.0', tagline } = {}) {
  const rightLines = [
    '',
    role.strong('Sakura Scheme') + role.dim(`  v${version}`),
    role.text('a language for humans and AI'),
    role.text('to program together'),
    '',
    role.dim('type ') + role.meta(',help') + role.dim('  ·  ') + role.meta(',ask sakura ') + role.dim('"…"'),
    role.dim('exit with ') + role.meta(',exit') + role.dim(' or ') + role.meta('Ctrl-D'),
    '',
  ]

  const out = []
  for (let i = 0; i < BLOSSOM_LINES.length; i++) {
    const left = BLOSSOM_LINES[i]
    const right = rightLines[i] || ''
    // Left blossom occupies a fixed visual column budget.
    // Padding right-side text with a 4-space gap.
    out.push(left.padEnd(28) + '  ' + right)
  }
  return out
}

/**
 * neutralBanner() — for `scheme-lang` with a non-Sakura dialect.
 * Just a small horizontal rule and the dialect name.
 */
export function neutralBanner({ name, version, tagline }) {
  return [
    '',
    role.section(name) + role.dim(`  v${version || '0'}`),
    tagline ? role.dim(tagline) : '',
    role.dim('type ,help  ·  ,exit to leave'),
    '',
  ]
}

/**
 * printBanner(lines, out=process.stdout)
 */
export function printBanner(lines, out = process.stdout) {
  for (const l of lines) out.write(l + '\n')
}
