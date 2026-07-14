// command-palette.js — Ctrl-Shift-P quick command runner.
//
// A modal that lists every IDE command (save, open, theme, mode, run,
// ask, format, quit, zen, etc.) and lets the user type-to-narrow. Enter
// runs the selected command; Esc cancels.
//
// The palette is populated at open time so it always shows current
// commands (theme lists, snippet lists, verb-navigator entries).
//
// A "command" is a plain object:
//   { id, label, hint, run(state) }
// where run() either mutates state or returns an action envelope the
// controller understands (same shape as vim/emacs execCommand return).

import { THEMES } from './themes.js'
import { SNIPPETS } from './snippets.js'

/**
 * Build the standard palette. `state` is the IDE state; some commands
 * introspect it (current file, current mode, buffer contents).
 */
export function buildPalette(state) {
  const cmds = []

  // ── file / buffer commands ─────────────────────────────────────────
  cmds.push({
    id: 'save',
    label: 'File: Save',
    hint: 'Ctrl-S · :w',
    run: () => 'save',
  })
  cmds.push({
    id: 'save-as',
    label: 'File: Save As…',
    hint: ':w <path>',
    run: () => ({ kind: 'prompt', prompt: 'Save as:', then: (path) => ({ kind: 'save-as', path }) }),
  })
  cmds.push({
    id: 'open',
    label: 'File: Open…',
    hint: ':e <path> · C-x C-f',
    run: () => ({ kind: 'prompt', prompt: 'Open file:', then: (path) => ({ kind: 'open', path }) }),
  })
  cmds.push({
    id: 'find-file',
    label: 'File: Find File (fuzzy)',
    hint: 'Ctrl-P',
    run: () => ({ kind: 'fuzzy-file-finder' }),
  })
  cmds.push({
    id: 'global-search',
    label: 'Edit: Search Across Files',
    hint: 'Ctrl-Shift-F',
    run: () => ({ kind: 'global-search' }),
  })

  // ── editor commands ───────────────────────────────────────────────
  cmds.push({
    id: 'run-buffer',
    label: 'Editor: Run Buffer',
    hint: 'Ctrl-Enter · :run',
    run: () => 'run',
  })
  cmds.push({
    id: 'toggle-line-numbers',
    label: 'View: Toggle Line Numbers',
    hint: '',
    run: (state) => ({ kind: 'toggle-line-numbers' }),
  })
  cmds.push({
    id: 'toggle-zen',
    label: 'View: Zen Mode (hide panes)',
    hint: 'F11',
    run: () => ({ kind: 'toggle-zen' }),
  })
  cmds.push({
    id: 'font-inc',
    label: 'View: Font Larger',
    hint: 'Ctrl-+',
    run: () => ({ kind: 'font-size', delta: 1 }),
  })
  cmds.push({
    id: 'font-dec',
    label: 'View: Font Smaller',
    hint: 'Ctrl--',
    run: () => ({ kind: 'font-size', delta: -1 }),
  })
  cmds.push({
    id: 'ask-sakura',
    label: 'Sakura: Ask',
    hint: 'Ctrl-K',
    run: () => ({ kind: 'ask' }),
  })

  // ── theme + mode ───────────────────────────────────────────────────
  for (const key of Object.keys(THEMES)) {
    cmds.push({
      id: `theme:${key}`,
      label: `Theme: ${key}`,
      hint: THEMES[key].display || '',
      run: () => ({ kind: 'theme', name: key }),
    })
  }
  cmds.push({
    id: 'mode-vim',
    label: 'Mode: Vim',
    hint: ':mode vim',
    run: () => ({ kind: 'mode', name: 'vim' }),
  })
  cmds.push({
    id: 'mode-emacs',
    label: 'Mode: Emacs',
    hint: ':mode emacs',
    run: () => ({ kind: 'mode', name: 'emacs' }),
  })

  // ── snippets — insert at cursor ────────────────────────────────────
  for (const s of SNIPPETS) {
    cmds.push({
      id: `snippet:${s.trigger}`,
      label: `Snippet: ${s.trigger}`,
      hint: s.label,
      run: () => ({ kind: 'insert-snippet', trigger: s.trigger }),
    })
  }

  // ── system ─────────────────────────────────────────────────────────
  cmds.push({
    id: 'quit',
    label: 'System: Quit',
    hint: 'Ctrl-Q · :q · C-x C-c',
    run: () => 'quit',
  })

  return cmds
}

/**
 * Open the palette — return the palette state object.
 */
export function openPalette(state) {
  return {
    kind: 'palette',
    query: '',
    selected: 0,
    all: buildPalette(state),
    matches: [],
    refresh() { this.matches = matchCommands(this.all, this.query) },
  }
}

/**
 * Score + filter commands.
 */
export function matchCommands(cmds, query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return cmds.slice(0, 50)
  const scored = []
  for (const c of cmds) {
    const l = c.label.toLowerCase()
    const id = c.id.toLowerCase()
    let score = 0
    if (l === q || id === q) score = 300
    else if (l.startsWith(q)) score = 200 - (l.length - q.length)
    else if (id.startsWith(q)) score = 180
    else if (l.includes(q)) score = 100
    else if (id.includes(q)) score = 80
    else {
      // Subsequence match (all chars of q appear in order in l)
      let li = 0, qi = 0
      while (li < l.length && qi < q.length) {
        if (l[li] === q[qi]) qi++
        li++
      }
      if (qi === q.length) score = 40
    }
    if (score > 0) scored.push({ c, score })
  }
  scored.sort((a, b) => b.score - a.score || a.c.label.length - b.c.label.length)
  return scored.slice(0, 50).map(s => s.c)
}
