// menu.js — clean dialect picker.
//
// Renders a small vertical menu; arrow keys navigate; Enter picks; q quits.
// No dependencies — raw TTY reads, same pattern as the REPL line editor.

import { role, PALETTE, fg, CTRL, isColorEnabled } from '../repl/palette.js'

export function pickDialect(dialects, { title = 'Which language you feelin?' } = {}) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Not a TTY — pick the first dialect and go.
      resolve(dialects[0])
      return
    }
    let index = 0
    const out = process.stdout

    const render = () => {
      out.write('\n')
      out.write('  ' + role.section(title) + '\n\n')
      dialects.forEach((d, i) => {
        const marker = i === index ? role.petal('▸ ') : '  '
        const core = d.isCore ? role.dim('  (core)') : ''
        const nameCol = (d.name + ' ').padEnd(16)
        const versionCol = ('v' + (d.version || '0')).padEnd(10)
        const line = marker + role.strong(nameCol) + role.dim(versionCol) + core
        const tag = d.tagline ? '\n      ' + role.dim(d.tagline) : ''
        out.write(line + tag + '\n')
      })
      out.write('\n')
      out.write('  ' + role.dim('[↑↓] pick   [Enter] launch   [q] quit') + '\n')
    }

    const clear = () => {
      // 3 header rows + 1 per dialect (+ 1 for tagline where present) + 2 trailer rows.
      const dialectRows = dialects.reduce((n, d) => n + (d.tagline ? 2 : 1), 0)
      const total = 3 + dialectRows + 2
      out.write(CTRL.moveUp(total))
      out.write('\x1b[J')
    }

    render()

    const onData = (buf) => {
      const s = buf.toString()
      if (s === '\x1b[A' || s === '\x1bOA' || s === 'k') { // up
        index = (index - 1 + dialects.length) % dialects.length
        clear(); render()
      } else if (s === '\x1b[B' || s === '\x1bOB' || s === 'j') { // down
        index = (index + 1) % dialects.length
        clear(); render()
      } else if (s === '\r' || s === '\n') { // enter
        if (process.stdin.setRawMode) process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.off('data', onData)
        resolve(dialects[index])
      } else if (s === 'q' || s === '\x03' || s === '\x04') { // quit / ctrl-c / ctrl-d
        if (process.stdin.setRawMode) process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.off('data', onData)
        out.write('\n')
        resolve(null)
      } else if (/^[0-9]$/.test(s)) {
        const n = parseInt(s, 10) - 1
        if (n >= 0 && n < dialects.length) {
          index = n
          clear(); render()
        }
      }
    }

    if (process.stdin.setRawMode) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}
