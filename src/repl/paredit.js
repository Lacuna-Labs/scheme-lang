// paredit.js — parse-tree-aware editing for the REPL line editor.
//
// Paredit turns the input buffer into a nested-parens tree and lets the
// user re-shape it structurally. The load-bearing moves:
//
//   slurpForward   move the innermost closing paren rightward, absorbing
//                  the next form
//   slurpBackward  move the innermost opening paren leftward, absorbing
//                  the previous form
//   barfForward    (splurge) move the innermost closing paren one form
//                  to the LEFT — spit out the last child
//   killForm       delete the form under the cursor
//   selectFormBounds return { start, end } of the form the cursor sits in
//
// We index by CHARACTER OFFSET in the buffer (not by AST node), so all
// operations return `{ buffer, cursor }` — the editor patches its own
// state from that. Strings and comments are respected: a `(` inside `"..."`
// or a `; ...` line comment doesn't count as an opening paren.
//
// This is a small paredit — enough to satisfy Ctrl-Alt shortcuts and
// unblock day-to-day editing. Full paredit (splice, wrap-*, forward-slurp
// past comments) can layer on top later.

const OPEN = new Set(['(', '['])
const CLOSE = new Set([')', ']'])
const MATCH = { '(': ')', '[': ']', ')': '(', ']': '[' }

/**
 * scan(buffer) → array of "categories" for each char position.
 *
 * cat is one of: 'code' | 'string' | 'comment'. This tells the other
 * operations which parens count.
 */
function scan(buffer) {
  const cat = new Array(buffer.length)
  let mode = 'code'    // 'code' | 'string' | 'comment'
  let escape = false
  for (let i = 0; i < buffer.length; i++) {
    const c = buffer[i]
    cat[i] = mode
    if (mode === 'code') {
      if (c === ';') mode = 'comment'
      else if (c === '"') mode = 'string'
    } else if (mode === 'string') {
      if (escape) { escape = false }
      else if (c === '\\') escape = true
      else if (c === '"') { mode = 'code' }
    } else if (mode === 'comment') {
      if (c === '\n') mode = 'code'
    }
    // If we set a new mode, mark the trigger char in the outer mode so
    // it counts as code (a `"` opening a string is still a code token).
    if (mode !== cat[i]) cat[i] = 'code'
  }
  return cat
}

/**
 * findFormBounds(buffer, cursor) → { start, end } of the form the cursor
 * is INSIDE (nearest enclosing pair), OR null if the cursor is at the
 * top level (no enclosing form).
 *
 * When the cursor sits ON the '(' or ')' of a form, that form is picked.
 */
export function findEnclosingForm(buffer, cursor) {
  const cat = scan(buffer)
  // Walk backward from cursor, count depth.
  let depth = 0
  let openAt = -1
  for (let i = cursor - 1; i >= 0; i--) {
    if (cat[i] !== 'code') continue
    const c = buffer[i]
    if (CLOSE.has(c)) depth++
    else if (OPEN.has(c)) {
      if (depth === 0) { openAt = i; break }
      depth--
    }
  }
  if (openAt < 0) return null
  const closeAt = matchOpen(buffer, cat, openAt)
  if (closeAt < 0) return null
  return { start: openAt, end: closeAt + 1 }
}

/** Given the position of an open paren, find its matching close. */
export function matchOpen(buffer, cat, openAt) {
  const open = buffer[openAt]
  const close = MATCH[open]
  let depth = 0
  for (let i = openAt + 1; i < buffer.length; i++) {
    if (cat[i] !== 'code') continue
    const c = buffer[i]
    if (c === open) depth++
    else if (c === close) {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

/** Given the position of a close paren, find its matching open. */
export function matchClose(buffer, cat, closeAt) {
  const close = buffer[closeAt]
  const open = MATCH[close]
  let depth = 0
  for (let i = closeAt - 1; i >= 0; i--) {
    if (cat[i] !== 'code') continue
    const c = buffer[i]
    if (c === close) depth++
    else if (c === open) {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

/**
 * Walk over one "form" starting at `pos` (skipping whitespace + commas).
 * Returns the exclusive end index. A form is a paren'd list, a string,
 * a comment (skipped), or a bare token.
 */
export function endOfNextForm(buffer, cat, pos) {
  let i = pos
  // Skip whitespace.
  while (i < buffer.length && /\s/.test(buffer[i])) i++
  if (i >= buffer.length) return -1
  const c = buffer[i]
  if (cat[i] !== 'code' && cat[i] !== 'string') return -1
  if (OPEN.has(c)) {
    const end = matchOpen(buffer, cat, i)
    return end < 0 ? -1 : end + 1
  }
  if (c === '"') {
    // Walk to closing "
    let j = i + 1
    while (j < buffer.length && buffer[j] !== '"') {
      if (buffer[j] === '\\') j++
      j++
    }
    return j + 1
  }
  // Bare atom — read until whitespace / paren.
  let j = i
  while (j < buffer.length && !/[\s()[\]"';]/.test(buffer[j])) j++
  return j
}

/**
 * Walk over one form ending at `pos` (looking BACKWARD). Returns the
 * start index of that form.
 */
export function startOfPrevForm(buffer, cat, pos) {
  let i = pos - 1
  // Skip trailing whitespace.
  while (i >= 0 && /\s/.test(buffer[i])) i--
  if (i < 0) return -1
  const c = buffer[i]
  if (CLOSE.has(c)) {
    const start = matchClose(buffer, cat, i)
    return start
  }
  if (c === '"') {
    // Walk backward to opening " (best-effort — no full escape trace).
    let j = i - 1
    while (j >= 0 && buffer[j] !== '"') j--
    return j
  }
  // Bare atom.
  let j = i
  while (j >= 0 && !/[\s()[\]"';]/.test(buffer[j])) j--
  return j + 1
}

// ── operations ────────────────────────────────────────────────────────

/**
 * slurpForward: move the innermost close paren rightward, absorbing the
 * next form after it. Returns the mutated buffer + cursor, OR the input
 * unchanged if there's nothing to slurp.
 */
export function slurpForward(buffer, cursor) {
  const form = findEnclosingForm(buffer, cursor)
  if (!form) return { buffer, cursor }
  const closePos = form.end - 1
  const cat = scan(buffer)
  const nextEnd = endOfNextForm(buffer, cat, form.end)
  if (nextEnd < 0) return { buffer, cursor }
  // Remove the close, then re-insert at nextEnd.
  const closeCh = buffer[closePos]
  const before = buffer.slice(0, closePos)
  const middle = buffer.slice(closePos + 1, nextEnd)
  const after = buffer.slice(nextEnd)
  const newBuf = before + middle + closeCh + after
  const newCursor = cursor > closePos ? cursor - 1 : cursor
  return { buffer: newBuf, cursor: newCursor }
}

/**
 * barfForward (splurge): move the innermost close paren LEFTWARD so the
 * last child form drops out.
 */
export function barfForward(buffer, cursor) {
  const form = findEnclosingForm(buffer, cursor)
  if (!form) return { buffer, cursor }
  const closePos = form.end - 1
  const cat = scan(buffer)
  // Find the last child form's START.
  // Walk backwards from closePos - 1 skipping whitespace to find the
  // start of the last form inside the parens.
  const lastStart = startOfPrevForm(buffer, cat, closePos)
  if (lastStart < 0 || lastStart <= form.start) return { buffer, cursor }
  // Trim the whitespace that was BETWEEN the previous child and the
  // form we're expelling — we want `(foo bar) baz`, not `(foo bar )baz`.
  // Walk left from `lastStart - 1` over whitespace.
  let insertAt = lastStart
  while (insertAt > form.start + 1 && /\s/.test(buffer[insertAt - 1])) insertAt--
  const closeCh = buffer[closePos]
  const before = buffer.slice(0, insertAt)
  const spacer = (lastStart > insertAt) ? ' ' : ''
  const middle = buffer.slice(lastStart, closePos)
  const after = buffer.slice(closePos + 1)
  const newBuf = before + closeCh + spacer + middle + after
  // Cursor stays where it was in buffer (roughly).
  let newCursor = cursor
  if (cursor > closePos) newCursor = cursor - 1
  else if (cursor >= insertAt && cursor < lastStart) newCursor = insertAt + 1
  return { buffer: newBuf, cursor: newCursor }
}

/**
 * slurpBackward: move the innermost OPEN paren leftward, absorbing the
 * previous form.
 */
export function slurpBackward(buffer, cursor) {
  const form = findEnclosingForm(buffer, cursor)
  if (!form) return { buffer, cursor }
  const openPos = form.start
  const cat = scan(buffer)
  const prevStart = startOfPrevForm(buffer, cat, openPos)
  if (prevStart < 0) return { buffer, cursor }
  const openCh = buffer[openPos]
  const before = buffer.slice(0, prevStart)
  const middle = buffer.slice(prevStart, openPos)
  const after = buffer.slice(openPos + 1)
  const newBuf = before + openCh + middle + after
  // Cursor stays put if to the right of openPos.
  const newCursor = cursor >= openPos ? cursor : cursor
  return { buffer: newBuf, cursor: newCursor }
}

/**
 * killForm: delete the form the cursor sits inside (including its parens).
 * If the cursor is at top level, do nothing.
 */
export function killForm(buffer, cursor) {
  const form = findEnclosingForm(buffer, cursor)
  if (!form) return { buffer, cursor }
  const newBuf = buffer.slice(0, form.start) + buffer.slice(form.end)
  return { buffer: newBuf, cursor: form.start }
}

/**
 * selectFormBounds: return the { start, end } of the form the cursor is
 * inside — the caller can highlight it, copy it, etc.
 */
export function selectFormBounds(buffer, cursor) {
  const f = findEnclosingForm(buffer, cursor)
  return f ? { start: f.start, end: f.end } : null
}
