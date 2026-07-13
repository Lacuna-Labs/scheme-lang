// auth/googleDeviceFlow.js — Google OAuth 2.0 device authorization flow.
//
// The device-flow shape:
//
//   1. Ask Google for a "device code" + "user code" pair.
//   2. Show the user code + verification URL. They open it on a phone
//      or laptop, enter the code, sign in, and grant permission.
//   3. Meanwhile we poll Google's token endpoint every N seconds. When
//      the user has approved, Google returns an access token + refresh
//      token.
//   4. Save the token to Cortex, keyed to the operator.
//
// Docs: https://developers.google.com/identity/protocols/oauth2/limited-input-device
//
// CLIENT ID: Alfred will provide a production client id later. For now
// we use a documented placeholder — the flow SHAPE works end-to-end;
// the placeholder just won't authorize against a real Google project.
// A comment marks the swap point.

const GOOGLE_DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code'
const GOOGLE_TOKEN_URL       = 'https://oauth2.googleapis.com/token'

// PLACEHOLDER — swap for real client id when Alfred provides it. The
// value here is intentionally NOT a real credential; it's a valid-shape
// stand-in that will fail the /device/code request with a clear
// "invalid_client" error, so any real login attempt gets flagged.
const DEFAULT_CLIENT_ID = 'PLACEHOLDER-scheme-lang-dev-client-id.apps.googleusercontent.com'

// The scopes we request. Openid + email + profile are the minimum for a
// "who is this operator?" identity flow. More scopes get added later
// when we wire specific Google APIs (Search Console, Merchant Center).
const DEFAULT_SCOPES = 'openid email profile'

/**
 * requestDeviceCode — step 1 of the flow. POST to /device/code with our
 * client id + scopes; get back the pair of codes plus the interval to
 * poll at.
 *
 * Returns:
 *   { device_code, user_code, verification_url, expires_in, interval }
 */
export async function requestDeviceCode({ clientId = DEFAULT_CLIENT_ID, scopes = DEFAULT_SCOPES } = {}) {
  const body = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
  })
  const res = await fetch(GOOGLE_DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    let msg = ''
    try { msg = await res.text() } catch { /* ignore */ }
    throw new Error(`Google /device/code failed (${res.status}): ${msg}`)
  }
  const data = await res.json()
  return {
    device_code:       data.device_code,
    user_code:         data.user_code,
    // Google returns `verification_url` on the limited-input flow and
    // sometimes `verification_uri` on the standard device flow —
    // handle both.
    verification_url:  data.verification_url || data.verification_uri || 'https://www.google.com/device',
    expires_in:        data.expires_in || 1800,
    interval:          data.interval || 5,
  }
}

/**
 * pollForToken — step 3. Repeatedly POST to /token with the device_code
 * until Google returns a token or the user rejects / it expires.
 *
 * `onWait` is called between attempts (default: no-op). This lets the
 * CLI print a "still waiting…" line without coupling the flow to any
 * particular UI.
 *
 * Returns { access_token, refresh_token, expires_in, id_token, scope }.
 */
export async function pollForToken({
  clientId = DEFAULT_CLIENT_ID,
  clientSecret = '',
  deviceCode,
  interval = 5,
  expiresIn = 1800,
  onWait = () => {},
} = {}) {
  const start = Date.now()
  const deadline = start + expiresIn * 1000
  let curInterval = interval

  while (Date.now() < deadline) {
    // Wait before polling. The spec says clients MUST wait `interval`
    // seconds between attempts.
    await new Promise((r) => setTimeout(r, curInterval * 1000))
    onWait()

    const body = new URLSearchParams({
      client_id: clientId,
      // Client secret only needed for confirmed (installed) apps. Blank
      // is OK for public-client desktop tools; the API is tolerant.
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    if (clientSecret) body.append('client_secret', clientSecret)

    let res
    try {
      res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    } catch (e) {
      // Network hiccup — try again next tick.
      continue
    }
    let data
    try { data = await res.json() } catch { data = {} }

    if (res.ok && data.access_token) {
      return data
    }
    // OAuth device flow uses a small set of "still waiting" errors —
    // handle each per the spec.
    if (data.error === 'authorization_pending') {
      // The user hasn't approved yet. Keep polling.
      continue
    }
    if (data.error === 'slow_down') {
      // We're polling too fast. Add 5s per spec.
      curInterval += 5
      continue
    }
    if (data.error === 'access_denied') {
      throw new Error('Google login: user denied access.')
    }
    if (data.error === 'expired_token') {
      throw new Error('Google login: code expired — run `sakura login` again.')
    }
    if (data.error) {
      throw new Error(`Google login: ${data.error} — ${data.error_description || ''}`)
    }
    // Unknown response — bubble up.
    throw new Error(`Google /token unexpected: ${JSON.stringify(data)}`)
  }
  throw new Error('Google login: timed out waiting for approval.')
}

/**
 * defaultClientId / defaultScopes — exposed for tests + docs.
 */
export const defaultClientId = DEFAULT_CLIENT_ID
export const defaultScopes = DEFAULT_SCOPES
