// nordic.js — 16-color Nordic-clean palette + ANSI escape helpers.
//
// The REPL's whole visual identity lives here. Solid, muted, warm-but-cool.
// No animation, no gradients, no 24-bit true-color surprises — just a small
// closed set of 256-color entries a terminal can render reliably.
//
// The palette is loosely Nord-inspired but pushed pink for the Sakura
// dialect. The neutral (`scheme-lang` launcher) palette skips the pink
// and stays cool.
//
// Every function returns a plain string with escape codes; no chalk, no
// picocolors, no dep to install. `NO_COLOR=1` disables everything.

const NO_COLOR = process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true'
const NOT_TTY = !process.stdout.isTTY

// The palette — closed 16-color set. Indexes are 256-color codes.
// Chosen so a xterm-256color terminal renders them consistently.
export const PALETTE = Object.freeze({
  // neutrals (nord-flavored)
  ink: 235,         // near-black, prompt / structural chars
  ash: 240,         // dim gray, comments / secondary text
  mist: 244,        // mid gray, ghost text / hints
  fog: 250,         // light gray, borders / dividers
  cream: 230,       // warm off-white, primary text
  paper: 255,       // pure white, high-emphasis
  // cool accents
  ice: 109,         // muted blue-gray, keywords
  frost: 74,        // clearer blue, functions
  moss: 108,        // muted green, strings / stems
  sage: 65,         // desaturated green, comments-alt
  // warm accents
  amber: 179,       // muted yellow, numbers
  ochre: 137,       // deep amber, warnings
  rust: 131,        // dim rust, errors
  // pink (Sakura core)
  petal: 218,       // main sakura pink
  bloom: 217,       // slightly deeper petal
  blush: 224,       // pale petal edges
  rose: 175,        // muted rose, accents
})

// Rainbow paren colors — closed 6-entry set, cycles by depth.
// Chosen to remain readable at any nesting level, not garish.
export const RAINBOW = Object.freeze([
  PALETTE.frost,
  PALETTE.moss,
  PALETTE.amber,
  PALETTE.rose,
  PALETTE.ice,
  PALETTE.ochre,
])

// ── ANSI helpers ─────────────────────────────────────────────────────

const ESC = '\x1b['

/** Wrap `text` in a 256-color foreground escape. */
export function fg(code, text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}38;5;${code}m${text}${ESC}0m`
}

/** Wrap `text` in a 256-color background escape. */
export function bg(code, text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}48;5;${code}m${text}${ESC}0m`
}

/** Dim + fg. Dim looks like a mist row above the cursor. */
export function dim(text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}2m${text}${ESC}0m`
}

/** Bold. Used sparingly — headings only. */
export function bold(text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}1m${text}${ESC}0m`
}

/** Italic. Used for verb signatures + doc snippets. */
export function italic(text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}3m${text}${ESC}0m`
}

/** Underline. Used for section labels. */
export function underline(text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}4m${text}${ESC}0m`
}

/** Inverse (background/foreground swap). Used for menu selection. */
export function inverse(text) {
  if (NO_COLOR || NOT_TTY) return String(text)
  return `${ESC}7m${text}${ESC}0m`
}

// ── cursor + line control (raw-mode input) ───────────────────────────

export const CTRL = Object.freeze({
  clearLine: `${ESC}2K`,
  clearRight: `${ESC}0K`,
  clearScreen: `${ESC}2J${ESC}H`,
  moveUp: (n = 1) => `${ESC}${n}A`,
  moveDown: (n = 1) => `${ESC}${n}B`,
  moveRight: (n = 1) => `${ESC}${n}C`,
  moveLeft: (n = 1) => `${ESC}${n}D`,
  saveCursor: `${ESC}s`,
  restoreCursor: `${ESC}u`,
  toColumn: (n) => `${ESC}${n}G`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
})

// ── semantic role helpers ────────────────────────────────────────────
// The rest of the REPL calls these instead of raw fg() so the palette
// stays a single point of truth. Rename here → everything follows.

export const role = Object.freeze({
  prompt:   (t) => fg(PALETTE.petal, t),
  banner:   (t) => fg(PALETTE.petal, t),
  petal:    (t) => fg(PALETTE.petal, t),
  bloom:    (t) => fg(PALETTE.bloom, t),
  blush:    (t) => fg(PALETTE.blush, t),
  stem:     (t) => fg(PALETTE.moss, t),
  text:     (t) => fg(PALETTE.cream, t),
  dim:      (t) => dim(fg(PALETTE.mist, t)),
  hint:     (t) => fg(PALETTE.mist, t),
  strong:   (t) => bold(fg(PALETTE.paper, t)),
  keyword:  (t) => fg(PALETTE.ice, t),
  fn:       (t) => fg(PALETTE.frost, t),
  string:   (t) => fg(PALETTE.moss, t),
  number:   (t) => fg(PALETTE.amber, t),
  comment:  (t) => fg(PALETTE.ash, t),
  ok:       (t) => fg(PALETTE.moss, t),
  warn:     (t) => fg(PALETTE.ochre, t),
  err:      (t) => fg(PALETTE.rust, t),
  section:  (t) => bold(fg(PALETTE.rose, t)),
  meta:     (t) => fg(PALETTE.rose, t),
})

export function isColorEnabled() {
  return !(NO_COLOR || NOT_TTY)
}
