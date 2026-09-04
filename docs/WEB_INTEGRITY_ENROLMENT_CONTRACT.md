# Web Integrity Enrolment Contract

The handshake between three pieces owned by three teams: the Turnstile check page on perawallet.app
(web), the enrolment flow in the extension's service worker (extension), and the enrol endpoint
(backend). Each is built against this document, so a change to any message shape, code or host here
is a change for all three.

## 1. Purpose

A web integrity token proves possession of a P-256 keypair the extension generated for itself.
Anyone can mint one, which is why guarded routes reject web tokens. Enrolment turns that
self-asserted key into a server-registered, revocable identity by gating registration behind a
Cloudflare Turnstile solve. After enrolment the backend can verify attest signatures against a stored
key, refuse un-enrolled installs, and revoke abusers.

Turnstile cannot run inside the extension: it ships an encrypted bytecode program interpreted in the
page, which is remotely hosted code and barred from extension pages regardless of CSP. The check
therefore runs on a page we host, and the result travels back to the extension.

## 2. Trust model

- **Root of trust:** the installation keypair (non-extractable P-256 in the service worker's
  IndexedDB, database `pera-integrity`) plus Cloudflare's `siteverify` answer. Nothing else is
  trusted.
- **The check page is untrusted.** Anyone can load it directly. It never sees the private key, never
  talks to our backend, and never calls `siteverify` (the secret stays server-side). The worst a
  hostile page can do is hand the extension a garbage or mismatched token, which enrolment rejects
  and the extension retries later.
- **The solve is bound to the key, not to the page's word.** The extension passes a key fingerprint
  into the page; the page puts it in Turnstile's `cData`; Cloudflare echoes it in the `siteverify`
  response; the backend compares it against the public key in the enrol request. A solve for one key
  cannot be reused for another, and no honesty is required from the page.
- **Identity is the key, not `device_id`.** `device_id` is client-minted and freely regenerable. It
  is a lookup handle bound 1:1 to a key at enrolment; clearing either storage slot never bypasses
  revocation because re-enrolment always costs a fresh solve.

## 3. Sequence

```mermaid
sequenceDiagram
    participant SW as Extension service worker
    participant Tab as Check page (perawallet.app)
    participant CF as Cloudflare Turnstile
    participant BE as Backend

    SW->>SW: onboarding complete or attest 403 (enrolment required / revoked)
    SW->>SW: kid = base64url(sha256(SPKI of install public key))
    SW->>Tab: chrome.tabs.create(check page URL with kid)
    Tab->>CF: render widget (action, cData = kid)
    CF-->>Tab: turnstile token (invisible where reputation allows)
    Tab->>SW: content script relays TURNSTILE_SOLVED over a runtime port
    SW->>SW: verify port.sender.origin, url path, kid matches pending enrolment
    SW->>BE: POST /api/v3/public/integrity/enrol (device_id, public_key, turnstile_token)
    BE->>CF: siteverify (secret, token, remoteip)
    CF-->>BE: success, action, cdata, hostname, challenge_ts
    BE->>BE: action and cdata == kid(public_key) and hostname allowed; store enrolment
    BE-->>SW: 200 enrolled
    SW->>SW: persist enrolment marker beside the key; close the tab
```

The mint loop never blocks on enrolment. Minting works un-enrolled until the backend enforces
enrolment (section 6.4); enrolment is a prerequisite the backend enforces and the client reacts to.

## 4. Page contract (web)

### 4.1 Location and environments

| environment | check page                                       | Turnstile sitekey                                                                                                                                                 |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production  | `https://integrity.perawallet.app/check`         | production sitekey, hostname allowlist = that host                                                                                                                |
| staging     | `https://integrity-staging.perawallet.app/check` | staging sitekey                                                                                                                                                   |
| local / e2e | any origin the dev build's manifest lists        | Cloudflare test sitekeys: `1x00000000000000000000AA` (always passes), `2x00000000000000000000AB` (always blocks), `3x00000000000000000000FF` (forces interactive) |

A dedicated subdomain rather than a path on the marketing site: the extension's content script must
match this origin exactly, the page needs its own strict CSP, and the host doubles as the Turnstile
hostname allowlist entry. The pair follows the existing `discover-mobile` / `discover-mobile-staging`
split.

### 4.2 Request URL

```
https://integrity.perawallet.app/check?v=1&kid=<base64url sha256 of SPKI DER>&lang=<BCP-47>
```

- `v`: contract version. The page refuses unknown versions with the `UNSUPPORTED_VERSION` error.
- `kid`: 43 characters, base64url without padding (`[A-Za-z0-9_-]`), which is exactly Turnstile's
  `cData` alphabet. This is the binding value; the page validates the shape and puts it in `cData`
  verbatim.
- `lang`: optional, for the page's own copy. Turnstile picks the browser language itself.

Nothing secret or personal is in the URL. The installation id never leaves the extension.

### 4.3 Widget configuration

```js
turnstile.render('#check', {
    sitekey: SITEKEY_FOR_THIS_HOST,
    action: 'pera-extension-enrol', // fixed; the backend requires this exact value
    cData: kidFromQuery, // the binding
    appearance: 'interaction-only', // invisible unless Cloudflare needs a click
    'refresh-expired': 'manual', // the extension owns retries, not the widget
    callback: onSolved,
    'error-callback': onError,
    'expired-callback': onExpired,
})
```

The page never calls `siteverify` and never stores the token. A Turnstile token is single-use and
valid for 300 seconds, so the page hands it over immediately.

### 4.4 Page to extension messages

The page has no direct access to `chrome.runtime`: the manifest keeps `externally_connectable`
closed on purpose. It posts to its own window, and an extension content script injected on this
origin relays to the service worker over a runtime port. The page only needs this:

```js
window.postMessage(
    {
        type: 'pera:integrity-check',
        v: 1,
        event: 'solved',
        kid,
        turnstileToken,
    },
    window.location.origin,
)
window.postMessage(
    { type: 'pera:integrity-check', v: 1, event: 'error', kid, code },
    window.location.origin,
)
```

`code` for `error` is one of `TURNSTILE_BLOCKED` (script failed to load, usually a blocker or
offline), `TURNSTILE_ERROR` (widget error callback, Cloudflare's code attached as `detail`),
`TURNSTILE_EXPIRED` (token expired before it was picked up), `UNSUPPORTED_VERSION`, `INVALID_KID`.

The page shows a retry button on every error. When the extension is not detected within a few
seconds (no `ready` event from the content script), it shows a plain message that the page only
works when opened by the Pera extension.

### 4.5 CSP and hygiene

`script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com;
connect-src 'self'`. No analytics, no cookies, no third-party scripts besides Turnstile: this page is
a bot check, and every extra script is attack surface on the one origin the extension listens to.

## 5. Extension contract

### 5.1 Ownership and triggers

The service worker is the sole owner of enrolment, as it is of minting. UI realms never enrol; they
send a request message and the worker decides. The offscreen document cannot participate (its
`chrome.storage.session` is poison-pilled).

Triggers, in order of expected frequency:

1. **Wallet onboarding completes.** The UI realm sends `INTEGRITY_ENROL_REQUEST` to the worker.
   Enrolment runs here, not lazily: fee delegation is the zero-balance onboarding path and often the
   user's first action, so a lazy check would land mid-transaction.
2. **Attest answers `403 APP_INTEGRITY_ENROLMENT_REQUIRED`.** Marker lost or the backend started
   enforcing. Re-enrol with the existing key.
3. **Attest answers `403 APP_INTEGRITY_REVOKED`.** Clear the key and the marker, generate a new key,
   enrol. The only time a user ever sees a second check.

Enrolment must not require an unlocked vault: it touches only the `pera-integrity` IndexedDB,
`chrome.tabs`, and `fetch`.

### 5.2 Single flight and lifecycle

- `navigator.locks.request('pera-integrity-enrol', ...)`, the same pattern as the mint lock, so
  popup plus expanded tab cannot open two check tabs.
- Open the check page with `chrome.tabs.create`, remember the tab id, register
  `chrome.tabs.onRemoved` for it.
- Wait for `solved` or `error` on the port, with an overall deadline of 4 minutes: inside
  Turnstile's 300-second token life, leaving time for the enrol call.
- On `solved`: `POST /integrity/enrol`. On 200, persist the marker, close the tab, clear backoff.
  On 4xx, close the tab and record a failure. On a network error, retry the POST once immediately
  and then stop: the token is single-use, so a second server-side attempt after a 5xx that actually
  processed it fails, and that failure means "check again on the next trigger".
- On `error`, tab closed, or deadline: abort, release the lock, record a failure.

Enrolment opens a visible tab, so it must never loop. At most one automatic attempt per trigger,
with exponential backoff between triggers (floor 5 minutes, cap 24 hours) persisted in
`chrome.storage.session` like the mint backoff. A user-initiated retry bypasses the backoff.

### 5.3 Relay and validation

Manifest additions (a Web Store review, so the hosts are decided once):

```json
{
    "matches": [
        "https://integrity.perawallet.app/*",
        "https://integrity-staging.perawallet.app/*"
    ],
    "js": ["content-integrity-check.js"],
    "run_at": "document_start",
    "world": "ISOLATED",
    "all_frames": false
}
```

`host_permissions` already covers `https://*.perawallet.app/*`. No new permission:
`chrome.tabs.create`, `chrome.tabs.remove` and `chrome.tabs.onRemoved` work without the `tabs`
permission.

The content script listens for the page's `postMessage` (same-origin only), acknowledges with a
`pera:integrity-check` / `ready` event so the page can detect the extension, and forwards over
`chrome.runtime.connect({ name: 'pera-integrity-check' })`:

```ts
type IntegrityCheckPortMessage =
    | { type: 'TURNSTILE_SOLVED'; v: 1; kid: string; turnstileToken: string }
    | {
          type: 'TURNSTILE_ERROR'
          v: 1
          kid: string
          code: string
          detail?: string
      }
```

The worker's `onConnect` handler accepts a message only when all of these hold; otherwise it
disconnects the port and logs at debug:

1. `port.name === 'pera-integrity-check'`.
2. `port.sender.origin` is exactly one of the configured check-page origins (the browser stamps
   this; the page cannot forge it), and `port.sender.url` starts with that origin plus `/check`.
3. An enrolment is pending, opened by this worker, whose `kid` equals the message's `kid`, and the
   port's `sender.tab.id` equals the tab the worker opened.
4. `turnstileToken` is a non-empty string of at most 2048 characters.

The page stays untrusted after these checks: the token is only ever forwarded to the backend, whose
`siteverify` result is the actual gate.

### 5.4 Storage

In the `pera-integrity` IndexedDB, beside the install key, a record `enrolment` =
`{ kid, enrolledAt }`. The worker treats "marker present and `kid` matches the current key" as
enrolled. A key regenerated for any reason invalidates the marker by construction.

### 5.5 Revocation handling in the mint loop

The mint loop distinguishes attest 403s by `code`: `APP_INTEGRITY_ENROLMENT_REQUIRED` keeps the key
and re-enrols; `APP_INTEGRITY_REVOKED` clears key and marker, then re-enrols; any other 403 clears
the key and lets the next attempt start clean. Both re-enrolments go through section 5.2's backoff,
so a revoked install cannot spin.

## 6. Backend contract

### 6.1 Endpoint

`POST /api/v3/public/integrity/enrol`, beside `challenge` and `attest`: the bootstrap path,
reachable with no integrity token and no Bearer.

```json
{
    "device_id": "<stable install id, 1..256 chars>",
    "public_key": "<SPKI DER, standard base64, max 256 chars>",
    "turnstile_token": "<as delivered by the widget, max 2048 chars>"
}
```

| status | body                                                        | when                                                                                                                                             |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `200`  | `{ "enrolled": true, "kid": "<base64url sha256 of SPKI>" }` | new enrolment or re-enrolment                                                                                                                    |
| `400`  | `{ "error", "code": "TURNSTILE_INVALID" }`                  | `siteverify` returned `success: false` (includes expired and already-used tokens)                                                                |
| `400`  | `{ "error", "code": "TURNSTILE_BINDING_MISMATCH" }`         | `siteverify` `cdata` differs from `kid(public_key)`, or `action` differs from `pera-extension-enrol`, or `hostname` is not an allowed check page |
| `400`  | `{ "error", "code": "INVALID_PUBLIC_KEY" }`                 | SPKI does not import as ECDSA P-256                                                                                                              |
| `409`  | `{ "error", "code": "PUBLIC_KEY_IN_USE" }`                  | the key is already enrolled under a different `device_id` (section 6.3)                                                                          |
| `503`  | `{ "error", "code": "TURNSTILE_UNAVAILABLE" }`              | `siteverify` unreachable; the client treats it as transient                                                                                      |

### 6.2 Verification

1. Validate shapes; import the SPKI with WebCrypto exactly as attest does; compute
   `kid = base64url(sha256(spkiDer))`.
2. Call `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` (env
   `TURNSTILE_SECRET_KEY`), `response` (the token) and `remoteip` (informational). Timeout 5
   seconds.
3. Require `success === true`, `action === 'pera-extension-enrol'`, `cdata === kid`, `hostname` in
   the allowed set (env `TURNSTILE_ALLOWED_HOSTNAMES`, comma-separated), and `challenge_ts` within
   the last 5 minutes.
4. Upsert the enrolment (section 6.3) in Postgres, not Redis: it must outlive the 300-second
   challenge TTL and survive restarts.

Dev and e2e use Cloudflare's test secret `1x0000000000000000000000000000000AA`, which accepts any
token; the `cdata` and `action` checks still apply, so the binding is exercised end to end without a
real solve.

### 6.3 Storage and the 1:1 rule

Table `bun_integrity_enrolment`: `kid` (primary key), `public_key`, `device_id` (unique),
`enrolled_at`, `last_attest_at`, `revoked_at`, `revocation_reason`.

- Enrol for a `device_id` that already has a different key: replace the row. Re-enrolment with a new
  key cost a fresh solve, which is the actual gate.
- Enrol for a key already bound to a different `device_id`: `409`. A key cannot serve two handles;
  the client regenerates its key on that path.
- Revocation sets `revoked_at`; the row stays so the same key can never re-enrol. Revocations are fed
  by the fee-delegation extraction detector (its abuse events carry the requesting device id) and by
  manual ops action.

### 6.4 Attest integration and enforcement

Behind `APP_INTEGRITY_WEB_REQUIRE_ENROLMENT` (default `false`):

- off: attest verifies the self-asserted key, and records `last_attest_at` when an enrolment exists.
- on: attest looks up `kid(public_key)`. Missing: `403 { code: "APP_INTEGRITY_ENROLMENT_REQUIRED" }`.
  Revoked: `403 { code: "APP_INTEGRITY_REVOKED" }`. Otherwise it verifies the signature against the
  stored key.

The flag flips only after the check page and the extension enrolment flow have shipped and enrolment
counts on staging look right; flipping earlier breaks every extension mint. iOS and Android paths are
untouched throughout.

### 6.5 Rate limiting

At the edge, consistent with keeping request rate limiting out of the Bun service. `enrol` needs a
tight per-IP rule: a solve is cheap to farm at scale even if never free. `challenge` and `attest`
keep theirs.

## 7. Decisions

1. **Standalone tab, not an iframe.** Turnstile keeps clearance state in the page's storage; an
   `https` iframe under a `chrome-extension://` top-level page gets partitioned storage, so
   reputation would not carry across sessions and more users would be pushed to the interactive
   checkbox. The contract works for both (the relay is the same content script with
   `all_frames: true`), so the iframe variant can be measured on current Chrome without changing it.
2. **Binding through Turnstile `cData`, verified server-side.** The alternative (the extension
   passes the installation id, the page echoes it back) trusts the page. `cData` is signed into the
   token by Cloudflare and echoed by `siteverify`, so the backend verifies the binding without
   trusting the page or the extension's message.
3. **Binding value is the key fingerprint, not `device_id`.** The identity is the key; binding the
   solve to the key means a solve cannot be transplanted onto another keypair, and the backend can
   compute the expected value from the request body alone.
4. **Content-script relay, not `externally_connectable`.** The manifest closes
   `externally_connectable` deliberately; opening it to a web origin would let that origin reach
   `chrome.runtime` directly and would require the page to know the extension id. The relay reuses
   the origin-checked bridge pattern Discover and Bidali already use.
5. **Enrol lives under `/api/v3/public`.** Trust cannot bootstrap from nothing: a fresh install has
   no token, and after the scope split it may have no API key either.
6. **Error codes are UPPER_SNAKE.** Matches the existing `APP_INTEGRITY_TOKEN_REQUIRED` /
   `APP_INTEGRITY_TOKEN_INVALID` / `APP_INTEGRITY_PLATFORM_NOT_ALLOWED` family so clients switch on
   one style.
7. **Backoff is per trigger with a 24-hour cap.** Enrolment shows a tab; a mint-style 60-minute cap
   would surface the check hourly to a user whose enrolment keeps failing.
8. **`remoteip` is informational.** Requiring the enrol request IP to match the page load would break
   users on dual-stack or rotating mobile networks for no gain the key binding does not already give.

## 8. Rollout order

The pieces have to land in this order, because each is tested against the one before it:

1. Web: check page on the staging host with the staging sitekey.
2. Backend: `enrol` endpoint, table, `siteverify`, tests against the test secret; enforcement off.
3. Extension: content script, relay, worker flow, marker, revocation codes.
4. Staging soak with enforcement off, watching enrolment counts and error codes.
5. `APP_INTEGRITY_WEB_REQUIRE_ENROLMENT` on staging, then production.
