// tests/r7rs-small/ports.test.mjs — R7RS-small §6.13 (input and output).
//
// String ports + bytevector ports work fully.
// File ports (open-input-file, open-output-file, with-input-from-file,
// etc.) are DEFERRED per decision-022 — verb-gated instead.
// read from ports is DEFERRED per decision-025 (runtime parsing gate).

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.13 port predicates ───────────────────────────────────────────────

test('§6.13 — port? on string port', () => {
  const { run } = makeRunner()
  assert.equal(run('(port? (open-output-string))'), true)
})

test('§6.13 — port? on non-port is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(port? 42)'), false)
})

test('§6.13 — input-port? / output-port?', () => {
  const { run } = makeRunner()
  assert.equal(run('(input-port? (open-input-string "hi"))'), true)
  assert.equal(run('(output-port? (open-output-string))'), true)
  assert.equal(run('(input-port? (open-output-string))'), false)
  assert.equal(run('(output-port? (open-input-string "hi"))'), false)
})

test('§6.13 — textual-port? / binary-port?', () => {
  const { run } = makeRunner()
  assert.equal(run('(textual-port? (open-output-string))'), true)
  assert.equal(run('(binary-port? (open-output-string))'), false)
  assert.equal(run('(binary-port? (open-output-bytevector))'), true)
  assert.equal(run('(textual-port? (open-output-bytevector))'), false)
})

// ── §6.13 close-port ────────────────────────────────────────────────────

test('§6.13 — input-port-open? / output-port-open?', () => {
  const { run } = makeRunner()
  const src = `(define p (open-input-string "hi"))
               (list (input-port-open? p)
                     (begin (close-port p) (input-port-open? p)))`
  assert.deepEqual(run(src), [true, false])
})

test('§6.13 — close-input-port / close-output-port work', () => {
  const { run } = makeRunner()
  const src = `(define p (open-output-string))
               (close-output-port p)
               (output-port-open? p)`
  assert.equal(run(src), false)
})

// ── §6.13 current-*-port ────────────────────────────────────────────────

test('§6.13 — current-input-port returns a port', () => {
  const { run } = makeRunner()
  assert.equal(run('(port? (current-input-port))'), true)
})

test('§6.13 — current-output-port returns a port', () => {
  const { run } = makeRunner()
  assert.equal(run('(port? (current-output-port))'), true)
})

test('§6.13 — current-error-port returns a port', () => {
  const { run } = makeRunner()
  assert.equal(run('(port? (current-error-port))'), true)
})

// ── §6.13 String ports ──────────────────────────────────────────────────

test('§6.13 — open-input-string + read-char', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "abc")))
                 (char->integer (read-char p)))`
  assert.equal(run(src), 97)  // 'a'
})

test('§6.13 — open-input-string + read-char reads through', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "ab")))
                 (list (char->integer (read-char p))
                       (char->integer (read-char p))
                       (eof-object? (read-char p))))`
  assert.deepEqual(run(src), [97, 98, true])
})

test('§6.13 — peek-char does not advance', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "abc")))
                 (list (char->integer (peek-char p))
                       (char->integer (peek-char p))
                       (char->integer (read-char p))))`
  assert.deepEqual(run(src), [97, 97, 97])
})

test('§6.13 — read-line', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "line1\nline2\nline3")))
                 (list (read-line p) (read-line p) (read-line p)))`
  assert.deepEqual(run(src), ['line1', 'line2', 'line3'])
})

test('§6.13 — read-line returns EOF at end', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "")))
                 (eof-object? (read-line p)))`
  assert.equal(run(src), true)
})

test('§6.13 — read-string reads k chars', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "hello world")))
                 (read-string 5 p))`
  assert.equal(run(src), 'hello')
})

// ── §6.13 String output ports ───────────────────────────────────────────

test('§6.13 — open-output-string + write-string + get-output-string', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (write-string "hello" p)
                 (get-output-string p))`
  assert.equal(run(src), 'hello')
})

test('§6.13 — write-char to output-string', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (write-char #\\h p)
                 (write-char #\\i p)
                 (get-output-string p))`
  assert.equal(run(src), 'hi')
})

test('§6.13 — display + newline to output-string', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (display "line1" p)
                 (newline p)
                 (display "line2" p)
                 (get-output-string p))`
  assert.equal(run(src), 'line1\nline2')
})

// ── §6.13 Bytevector ports ──────────────────────────────────────────────

test('§6.13 — open-input-bytevector + read-u8', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-bytevector (bytevector 10 20 30))))
                 (list (read-u8 p) (read-u8 p) (read-u8 p) (eof-object? (read-u8 p))))`
  assert.deepEqual(run(src), [10, 20, 30, true])
})

test('§6.13 — peek-u8 does not advance', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-bytevector (bytevector 1 2 3))))
                 (list (peek-u8 p) (peek-u8 p) (read-u8 p)))`
  assert.deepEqual(run(src), [1, 1, 1])
})

test('§6.13 — open-output-bytevector + write-u8 + get-output-bytevector', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-bytevector)))
                 (write-u8 65 p)
                 (write-u8 66 p)
                 (write-u8 67 p)
                 (get-output-bytevector p))`
  const b = run(src)
  assert.equal(b.length, 3)
  assert.equal(b[0], 65)
  assert.equal(b[2], 67)
})

// ── §6.13 eof-object ────────────────────────────────────────────────────

test('§6.13 — eof-object returns the eof value', () => {
  const { run } = makeRunner()
  assert.equal(run('(eof-object? (eof-object))'), true)
})

test('§6.13 — eof-object? on non-eof is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(eof-object? 42)'), false)
})

// ── §6.13 char-ready? / u8-ready? ───────────────────────────────────────

test('§6.13 — char-ready? on open input-string is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-ready? (open-input-string "hi"))'), true)
})

test('§6.13 — u8-ready? on open bytevector-input is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(u8-ready? (open-input-bytevector (bytevector 1 2)))'), true)
})

// ── §6.13 flush-output-port ─────────────────────────────────────────────

test('§6.13 — flush-output-port is a no-op that returns without error', () => {
  const { run } = makeRunner()
  // Just check it doesn't raise.
  run('(flush-output-port (open-output-string))')
})

// ── §6.13 File ports — DEFERRED per decision-022 ────────────────────────

test('§6.13 — open-input-file not registered (decision-022)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(open-input-file "any.txt")'),
    /unbound symbol: open-input-file/)
})

test('§6.13 — open-output-file not registered (decision-022)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(open-output-file "any.txt")'),
    /unbound symbol: open-output-file/)
})

test('§6.13 — open-binary-input-file not registered (decision-022)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(open-binary-input-file "any.bin")'),
    /unbound symbol: open-binary-input-file/)
})

test('§6.13 — with-input-from-file not registered (decision-022)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(with-input-from-file "x" (lambda () 1))'),
    /unbound symbol: with-input-from-file/)
})

test('§6.13 — call-with-input-file not registered (decision-022)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(call-with-input-file "x" (lambda (p) 1))'),
    /unbound symbol: call-with-input-file/)
})

// ── §6.13 `read` — DEFERRED per decision-025 ────────────────────────────

test('§6.13 — read not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(read (open-input-string "(+ 1 2)"))'),
    /unbound symbol: read/)
})
