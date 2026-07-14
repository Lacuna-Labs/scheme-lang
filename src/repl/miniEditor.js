// miniEditor.js — the tiny in-REPL editor invoked via `,edit`.
//
// Alfred's ask (2026-07-14): "the mini editors that comes with the
// language" — a small focused block-editor for a multi-line snippet,
// similar to Python's `PyREPL` block-edit or Julia's `edit()`. Not the
// full terminal IDE — just enough to author a multi-line form without
// leaving the REPL prompt.
//
// Two paths:
//
//   1. If `$EDITOR` (or the config `editor` key) is set, we hand the
//      buffer to that editor via a tempfile, spawn it inheriting the
//      terminal, then read it back on exit and evaluate the contents.
//      This is what heavyweight REPLs do (IPython, IEx, Julia's
//      edit()) and it's the ONE path that always Just Works — the
//      user already knows their editor.
//
//   2. If no `$EDITOR` (or the user asks for `,edit --inline`), we
//      fall back to a tiny in-place raw-mode capture: type freely,
//      `:w` on empty line submits, `:q` cancels. Preserves indent.
//
// `,edit <path>` variant — pre-fills the buffer with `<path>`'s
// contents (if it exists) so the user can quick-edit a saved cart
// without leaving the REPL. Writes the buffer back to <path> on
// successful submit AND evaluates it.

import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { role } from './palette.js'
import { isBalanced } from './highlight.js'

/**
 * openMiniEditor(ctx, { path, prefill, inline }) → { ok, text, error }
 *
 * ctx    — REPL context (writeLine, out)
 * path   — optional file to load AND persist to
 * prefill — string to seed the buffer with (used when no path)
 * inline  — force the raw-mode fallback even when $EDITOR is set
 */
export async function openMiniEditor(ctx, opts = {}) {
  const { path, prefill, inline } = opts

  // Resolve initial buffer content.
  let initial = ''
  if (path && existsSync(path)) {
    try { initial = readFileSync(path, 'utf-8') }
    catch (e) { return { ok: false, error: `cannot read ${path}: ${e.message}` } }
  } else if (prefill) {
    initial = prefill
  } else {
    initial = ';; ,edit — write your form, :w submits, :q cancels\n'
  }

  // Detect $EDITOR path unless inline forced.
  const editor = !inline && (
    (ctx.config && ctx.config.editor) || process.env.EDITOR || process.env.VISUAL
  )

  if (editor) {
    return externalEditor(ctx, editor, initial, path)
  }
  return inlineEditor(ctx, initial, path)
}

// External editor path — write to tempfile, spawn inheriting stdio,
// read back on exit. This is the reliable path.
function externalEditor(ctx, editor, initial, savePath) {
  const tmpPath = savePath || join(tmpdir(), `sakura-edit-${process.pid}-${Date.now()}.scm`)
  const shouldDeleteAfter = !savePath
  try {
    writeFileSync(tmpPath, initial, 'utf-8')
    ctx.writeLine(role.dim(`  (opening ${editor}…)`))
    const wasRaw = process.stdin.isTTY && process.stdin.isRaw
    if (wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(false)
    const r = spawnSync(editor, [tmpPath], { stdio: 'inherit' })
    if (wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(true)
    if (r.status !== 0) {
      if (shouldDeleteAfter) { try { unlinkSync(tmpPath) } catch {} }
      return { ok: false, error: `editor exited with status ${r.status}` }
    }
    const text = readFileSync(tmpPath, 'utf-8')
    if (shouldDeleteAfter) { try { unlinkSync(tmpPath) } catch {} }
    return { ok: true, text, path: savePath || null }
  } catch (e) {
    if (shouldDeleteAfter) { try { unlinkSync(tmpPath) } catch {} }
    return { ok: false, error: e.message }
  }
}

// Raw-mode inline editor — a tiny capture loop, line-buffered readline.
// No cursor movement, no syntax highlighting mid-stroke. Line-by-line.
async function inlineEditor(ctx, initial, savePath) {
  const { createInterface } = await import('node:readline')
  const lines = initial.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  ctx.writeLine('')
  ctx.writeLine(role.dim('  ── mini-editor (inline) ──'))
  ctx.writeLine(role.dim('  :w to submit · :q to cancel · blank line submits if balanced'))
  ctx.writeLine('')
  for (const l of lines) ctx.writeLine(role.dim('  │ ') + l)

  const wasRaw = process.stdin.isTTY && process.stdin.isRaw
  if (wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(false)

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: '  │ ',
    })
    rl.prompt()
    const finish = (result) => {
      rl.close()
      if (wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(true)
      resolve(result)
    }
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (trimmed === ':w') {
        const text = lines.join('\n') + (lines.length ? '\n' : '')
        if (savePath) { try { writeFileSync(savePath, text, 'utf-8') } catch {} }
        return finish({ ok: true, text, path: savePath || null })
      }
      if (trimmed === ':q') return finish({ ok: false, error: 'cancelled' })
      if (trimmed === '' && lines.length && isBalanced(lines.join('\n'))) {
        const text = lines.join('\n') + '\n'
        if (savePath) { try { writeFileSync(savePath, text, 'utf-8') } catch {} }
        return finish({ ok: true, text, path: savePath || null })
      }
      lines.push(line)
      rl.prompt()
    })
    rl.on('SIGINT', () => finish({ ok: false, error: 'cancelled (Ctrl-C)' }))
  })
}
