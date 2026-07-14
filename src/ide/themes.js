// themes.js — swappable IDE themes for the terminal + web IDE.
//
// Four themes ship in v0.0. Each is a plain object of ANSI 256-color
// indexes; the terminal IDE maps them via ANSI escapes, the web IDE
// compiles them to CSS. `:theme <name>` switches at runtime.
//
// Adding a theme: extend the exported map and document below. Please
// keep the shape identical — every consumer indexes by key.

export const THEMES = Object.freeze({
  sakura: {
    name: 'sakura',
    display: 'Sakura — the branded mode, warm paper, cherry blossom',
    // The signature theme. Pale cream surface (from the reference
    // fantasy-console displays), soft ink, bright pink accent, gold
    // for flower centers. This is the flower's home.
    promptGlyph: '✿ ',
    bg:        231, // near-white cream
    text:      53,  // deep purple ink
    dim:       247, // mist
    accent:    212, // pink blossom
    accent2:   221, // gold flower center
    keyword:   61,  // muted blue
    fn:        67,
    string:    108, // moss
    number:    172, // amber
    comment:   250, // fog
    ok:        108,
    warn:      179,
    err:       124,
    border:    253, // pale
    selection: 224, // petal
    web: {
      bg:        '#fdfaf6',
      text:      '#2a1f3d',
      dim:       '#8a7a8a',
      accent:    '#ef6ea6',
      accent2:   '#f6c453',
      keyword:   '#6b7ea8',
      fn:        '#5687bf',
      string:    '#5e8b5e',
      number:    '#c07a3e',
      comment:   '#c5b5c5',
      ok:        '#7fa66f',
      warn:      '#c8a147',
      err:       '#c15c5c',
      border:    '#f3e3ed',
      selection: '#fce4e8',
      font:      'iA Writer Mono, Berkeley Mono, JetBrains Mono, ui-monospace, monospace',
    },
  },
  hacker: {
    name: 'hacker',
    display: 'Hacker — black surface, phosphor green, no decoration',
    // For people who arrive at the REPL knowing what they want and
    // don't want the flower in the way. Black terminal, phosphor
    // green, plain `> ` prompt. No accent flourishes. Fast text.
    promptGlyph: '> ',
    bg:        16,  // true black
    text:      46,  // phosphor green
    dim:       28,  // dim green
    accent:    83,  // lighter green
    accent2:   40,  // mid green
    keyword:   46,  // same as text (no differentiation on purpose)
    fn:        119, // slight variation
    string:    121, // pale green
    number:    40,
    comment:   22,  // very dim green
    ok:        46,
    warn:      226, // yellow (only splash of non-green — errors + warnings)
    err:       196, // red (errors only)
    border:    22,
    selection: 22,
    web: {
      bg:        '#000000',
      text:      '#00ff41',
      dim:       '#00a028',
      accent:    '#33ff77',
      accent2:   '#22cc44',
      keyword:   '#00ff41',
      fn:        '#66ffaa',
      string:    '#aaffcc',
      number:    '#22cc44',
      comment:   '#007f22',
      ok:        '#00ff41',
      warn:      '#ffff00',
      err:       '#ff3333',
      border:    '#003311',
      selection: '#003311',
      font:      'IBM Plex Mono, Menlo, ui-monospace, monospace',
    },
  },
  'sakura-light': {
    name: 'sakura-light',
    display: 'Sakura Light — warm cream, pink accents',
    // Per-theme prompt glyph — the REPL prompt gets a different tail
    // for each theme. Kept tiny + typographic; one glyph max, never
    // gaudy. `sakura` (the branded default) gets ✿; sakura-light gets
    // ❀ (heavy blossom); sakura-dark gets ❦ (night blossom);
    // high-contrast gets › (utilitarian chevron); paper gets » (guillemet);
    // hacker gets `> ` (plain, no flair).
    promptGlyph: '❀ ',
    // Terminal colors (256-color palette indexes)
    bg:        231, // near-white background
    text:      235, // dark ink
    dim:       244, // mist gray
    accent:    175, // rose
    accent2:   217, // bloom
    keyword:   61,  // muted blue
    fn:        67,  // clear blue
    string:    64,  // moss
    number:    172, // amber
    comment:   248, // silver
    ok:        108, // moss
    warn:      179, // ochre
    err:       124, // deep red
    border:    250, // fog
    selection: 224, // pale petal
    // Web CSS
    web: {
      bg:        '#faf7f4',
      text:      '#1a1a1a',
      dim:       '#8a8a8a',
      accent:    '#d47c92',
      accent2:   '#f7c5cf',
      keyword:   '#6b7ea8',
      fn:        '#5687bf',
      string:    '#5e8b5e',
      number:    '#c07a3e',
      comment:   '#b5b5b5',
      ok:        '#7fa66f',
      warn:      '#c8a147',
      err:       '#c15c5c',
      border:    '#e0dcd6',
      selection: '#fce4e8',
      font:      'JetBrains Mono, Menlo, ui-monospace, monospace',
    },
  },
  'sakura-dark': {
    name: 'sakura-dark',
    display: 'Sakura Dark — deep purple bg, cream text, magenta accents',
    promptGlyph: '❦ ',
    bg:        16,  // near-black
    text:      230, // cream
    dim:       244,
    accent:    218, // petal
    accent2:   175, // rose
    keyword:   109, // ice
    fn:        74,  // frost
    string:    108, // moss
    number:    179, // amber
    comment:   240, // ash
    ok:        108,
    warn:      179,
    err:       131, // rust
    border:    237,
    selection: 89,
    web: {
      bg:        '#1a1424',
      text:      '#f0e6dc',
      dim:       '#8b8896',
      accent:    '#f7b6c8',
      accent2:   '#d47c92',
      keyword:   '#9ab6c8',
      fn:        '#7ab5db',
      string:    '#8ec080',
      number:    '#e5b06e',
      comment:   '#7a7a8a',
      ok:        '#8ec080',
      warn:      '#e5b06e',
      err:       '#e07474',
      border:    '#2e2842',
      selection: '#3d2e52',
      font:      'JetBrains Mono, Menlo, ui-monospace, monospace',
    },
  },
  'high-contrast': {
    name: 'high-contrast',
    display: 'High Contrast — black bg, white text, yellow accents',
    promptGlyph: '› ',
    bg:        16,
    text:      231,
    dim:       247,
    accent:    226, // bright yellow
    accent2:   214,
    keyword:   51,  // cyan
    fn:        45,
    string:    82,  // green
    number:    226,
    comment:   243,
    ok:        46,
    warn:      226,
    err:       196,
    border:    238,
    selection: 240,
    web: {
      bg:        '#000000',
      text:      '#ffffff',
      dim:       '#a0a0a0',
      accent:    '#ffd700',
      accent2:   '#ffb347',
      keyword:   '#00ffff',
      fn:        '#00e0ff',
      string:    '#00ff00',
      number:    '#ffff00',
      comment:   '#808080',
      ok:        '#00ff00',
      warn:      '#ffd700',
      err:       '#ff3333',
      border:    '#404040',
      selection: '#404040',
      font:      'JetBrains Mono, Menlo, ui-monospace, monospace',
    },
  },
  paper: {
    name: 'paper',
    display: 'Paper — off-white bg, black serif shape, print aesthetic',
    promptGlyph: '» ',
    bg:        255,
    text:      232,
    dim:       241,
    accent:    89,  // deep purple
    accent2:   125,
    keyword:   58,
    fn:        24,
    string:    22,
    number:    130,
    comment:   246,
    ok:        22,
    warn:      130,
    err:       88,
    border:    248,
    selection: 253,
    web: {
      bg:        '#f5f2ea',
      text:      '#1a1a1a',
      dim:       '#606060',
      accent:    '#6b2c5e',
      accent2:   '#8f3d70',
      keyword:   '#4a3a1a',
      fn:        '#2d4a6b',
      string:    '#2d5a2d',
      number:    '#8a4a1a',
      comment:   '#8a8578',
      ok:        '#2d5a2d',
      warn:      '#8a4a1a',
      err:       '#8b1a1a',
      border:    '#c8c3b8',
      selection: '#e5e0d3',
      font:      'Iosevka, Cousine, Georgia, serif',
    },
  },
})

export const DEFAULT_THEME = 'sakura-dark'

let currentTheme = DEFAULT_THEME

export function getTheme(name = currentTheme) {
  return THEMES[name] || THEMES[DEFAULT_THEME]
}

export function setTheme(name) {
  if (!THEMES[name]) return false
  currentTheme = name
  return true
}

export function currentThemeName() {
  return currentTheme
}

export function themeList() {
  return Object.keys(THEMES)
}

/**
 * The prompt glyph for the current (or named) theme. This is the tiny
 * tail on the REPL prompt — one grapheme + one space. If a theme is
 * missing a glyph we fall back to the default theme's glyph, and if
 * even that is missing, a plain '> '.
 */
export function promptGlyph(name = currentTheme) {
  const t = THEMES[name] || THEMES[DEFAULT_THEME]
  if (t && t.promptGlyph) return t.promptGlyph
  const d = THEMES[DEFAULT_THEME]
  if (d && d.promptGlyph) return d.promptGlyph
  return '> '
}
