// auth/cli.js — the `sakura login`, `sakura logout`, `sakura whoami`
// subcommand implementations.
//
// The commands live in one file so the CLI binary can import a small
// object and dispatch by name. Each command writes user-friendly output
// and returns an exit code the binary can pass to `process.exit`.

import { requestDeviceCode, pollForToken, defaultClientId } from './googleDeviceFlow.js'
import { saveAuth, clearAuth, currentAuth, loadAuthFromDisk } from './store.js'

// Try to color output if the palette module is available (it's part of
// scheme-lang's REPL machinery). Fall back to plain if not.
async function loadPalette() {
  try {
    const mod = await import('../repl/palette.js')
    return mod.role
  } catch {
    // No-op palette so the code below stays clean.
    const passthrough = (s) => s
    return {
      strong: passthrough,
      dim:    passthrough,
      fn:     passthrough,
      text:   passthrough,
      warn:   passthrough,
      ok:     passthrough,
    }
  }
}

// ── login ─────────────────────────────────────────────────────────────

/**
 * runLogin — kicks off the Google device-flow. Prints the code +
 * URL for the operator to visit, polls until Google approves, then
 * saves the token.
 */
export async function runLogin({ clientId = null, clientSecret = '' } = {}) {
  const role = await loadPalette()
  loadAuthFromDisk()

  // Warn about the placeholder client id up-front. It works structurally
  // but a real device-code request will fail at Google's end until we
  // wire the real credential.
  const usingPlaceholder = !clientId || clientId === defaultClientId
  if (usingPlaceholder) {
    process.stdout.write(role.dim(
      '(note: using a placeholder Google client id. ' +
      'A production client id will be wired later; ' +
      'until then, the auth flow demo-runs but Google will reject the request.)\n\n'
    ))
  }

  let deviceCode
  try {
    deviceCode = await requestDeviceCode({ clientId })
  } catch (e) {
    process.stderr.write(role.warn('login failed: ' + (e.message || String(e)) + '\n'))
    return 1
  }

  process.stdout.write('\n' + role.strong('Sign in to Google') + '\n')
  process.stdout.write('\n  ' + role.text('1. Open ') + role.fn(deviceCode.verification_url) + '\n')
  process.stdout.write('  ' + role.text('2. Enter this code:') + '  ' + role.strong(deviceCode.user_code) + '\n')
  process.stdout.write('\n' + role.dim('  (waiting for approval — ' + Math.floor(deviceCode.expires_in / 60) + ' min timeout)') + '\n\n')

  let dots = 0
  const onWait = () => {
    dots = (dots + 1) % 4
    // Overwrite the same line so we don't spam.
    process.stdout.write('\r' + role.dim('  polling' + '.'.repeat(dots) + '   '))
  }

  let token
  try {
    token = await pollForToken({
      clientId,
      clientSecret,
      deviceCode: deviceCode.device_code,
      interval:   deviceCode.interval,
      expiresIn:  deviceCode.expires_in,
      onWait,
    })
  } catch (e) {
    process.stdout.write('\n')
    process.stderr.write(role.warn('login failed: ' + (e.message || String(e)) + '\n'))
    return 1
  }
  process.stdout.write('\r' + ' '.repeat(20) + '\r')  // clear the polling line

  // Grab basic identity if we can — Google returns an id_token JWT.
  const user = decodeIdTokenBasics(token.id_token || '')

  saveAuth({
    provider:   'google',
    token:      token.access_token,
    refresh:    token.refresh_token || null,
    expiresIn:  token.expires_in || 3600,
    user,
  })

  process.stdout.write(role.ok('signed in') +
    (user && user.email ? role.text(' as ' + user.email) : '') + '\n')
  return 0
}

// ── logout ────────────────────────────────────────────────────────────

/**
 * runLogout — clear the current auth. Silent if nothing to clear.
 */
export async function runLogout() {
  const role = await loadPalette()
  loadAuthFromDisk()
  const cur = currentAuth()
  if (!cur) {
    process.stdout.write(role.dim('not signed in\n'))
    return 0
  }
  clearAuth(cur.provider)
  process.stdout.write(role.ok('signed out of ' + cur.provider) + '\n')
  return 0
}

// ── whoami ────────────────────────────────────────────────────────────

/**
 * runWhoami — print the current auth state.
 */
export async function runWhoami() {
  const role = await loadPalette()
  loadAuthFromDisk()
  const cur = currentAuth()
  if (!cur) {
    process.stdout.write(role.dim('not signed in — run `sakura login`\n'))
    return 0
  }
  process.stdout.write(role.strong('signed in') + ' via ' + role.fn(cur.provider) + '\n')
  if (cur.user) {
    if (cur.user.email) process.stdout.write('  ' + role.text('email:  ') + cur.user.email + '\n')
    if (cur.user.name)  process.stdout.write('  ' + role.text('name:   ') + cur.user.name + '\n')
  }
  if (cur.expiresAt) {
    const secs = Math.max(0, Math.floor((cur.expiresAt - Date.now()) / 1000))
    process.stdout.write('  ' + role.text('expires: ') + role.dim(formatDuration(secs)) + '\n')
  }
  return 0
}

// ── helpers ───────────────────────────────────────────────────────────

/**
 * decodeIdTokenBasics — pull email/name/id out of a Google id_token
 * WITHOUT validating the signature. This is safe because we JUST
 * received it from Google over TLS; using it for display only is fine.
 * A real security check (audience, issuer, signature) would happen
 * before trusting it for authorization.
 */
function decodeIdTokenBasics(idToken) {
  if (!idToken || typeof idToken !== 'string') return null
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    // JWTs are base64url. Node's Buffer handles that with `'base64url'`.
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return {
      id:    payload.sub || null,
      email: payload.email || null,
      name:  payload.name  || null,
    }
  } catch {
    return null
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return seconds + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm'
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm'
}
