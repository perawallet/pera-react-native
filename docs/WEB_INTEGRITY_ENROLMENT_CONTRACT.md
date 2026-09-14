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
therefore runs on a page we host, embedded in the extension as an iframe, and the result travels back
to the extension.

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
    participant Page as Extension page (onboarding)
    participant Frame as Check page iframe (perawallet.app)
    participant CF as Cloudflare Turnstile
    participant BE as Backend

    SW->>SW: onboarding complete or attest 403 (enrolment required / revoked)
    SW->>SW: kid = base64url(sha256(SPKI of install public key))
    SW->>Page: show-check-frame(url with kid), hidden
    Page->>Frame: mount iframe, visually hidden
    Frame->>CF: render widget (action, cData = kid, interaction-only)
    alt Cloudflare needs a click
        Frame->>SW: interactive-required (via content script)
        SW->>Page: expand-check-frame
        CF-->>Frame: user clicks, token
    else invisible
        CF-->>Frame: token
    end
    Frame->>SW: content script relays TURNSTILE_SOLVED over a runtime port
    SW->>SW: verify port.sender.origin, url path, kid matches pending enrolment
    SW->>BE: POST /api/v3/public/integrity/enrol (device_id, public_key, turnstile_token)
    BE->>CF: siteverify (secret, token, remoteip)
    CF-->>BE: success, action, cdata, hostname, challenge_ts
    BE->>BE: action and cdata == kid(public_key) and hostname allowed; store enrolment
    BE-->>SW: 200 enrolled
    SW->>Page: hide-check-frame; persist enrolment marker beside the key
```

The mint loop never blocks on enrolment. Minting works un-enrolled until the backend enforces
enrolment (section 6.4); enrolment is a prerequisite the backend enforces and the client reacts to.

## 4. Page contract (web)

### 4.1 Location and environments

| environment | check page                                       | Turnstile sitekey                                                                                                                                                      |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production  | `https://integrity.perawallet.app/check`         | production sitekey, hostname allowlist = that host                                                                                                                     |
| staging     | `https://integrity-staging.perawallet.app/check` | staging sitekey                                                                                                                                                        |
| local / e2e | any origin the dev build's manifest lists        | Cloudflare test sitekeys: `1x00000000000000000000BB` (passes invisibly), `1x00000000000000000000AA` (passes, visible), `3x00000000000000000000FF` (forces interactive) |

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

Nothing secret or personal is in the URL. The installation id never leaves the extension. The page
behaves the same whether it is framed or opened as a tab; it does not need to know which.

### 4.3 Widget configuration

```js
turnstile.render('#check', {
    sitekey: SITEKEY_FOR_THIS_HOST,
    action: 'pera-extension-enrol', // fixed; the backend requires this exact value
    cData: kidFromQuery, // the binding
    appearance: 'interaction-only', // nothing rendered unless Cloudflare needs a click
    'refresh-expired': 'manual', // the extension owns retries, not the widget
    'before-interactive-callback': onInteractiveRequired, // the extension expands the frame
    'after-interactive-callback': onInteractiveDone,
    callback: onSolved,
    'error-callback': onError,
    'expired-callback': onExpired,
})
```

`interaction-only` keeps the widget invisible for the large majority of solves. When Cloudflare does
need a click, `before-interactive-callback` fires before the checkbox renders, which is the moment
the page tells the extension to make the frame visible.

The page never calls `siteverify` and never stores the token. A Turnstile token is single-use and
valid for 300 seconds, so the page hands it over immediately.

### 4.4 Page to extension messages

The page has no direct access to `chrome.runtime`: the manifest keeps `externally_connectable`
closed on purpose. It posts to its own window, and an extension content script injected on this
origin relays to the service worker over a runtime port. The page only needs this:

```js
window.postMessage(
    { type: 'pera:integrity-check', v: 1, event: 'interactive-required', kid },
    window.location.origin,
)
window.postMessage(
    { type: 'pera:integrity-check', v: 1, event: 'interactive-done', kid },
    window.location.origin,
)
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

While the widget is invisible the page renders nothing but its status text, so a hidden frame has
nothing to show. Once interaction is required the page shows the widget, a one-line explanation
("Quick check before Pera can sponsor your first transactions") and a retry button on error. When
the extension is not detected within a few seconds (no `ready` event from the content script), it
shows a plain message that the page only works when opened by the Pera extension.

### 4.5 CSP and hygiene

`script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com;
connect-src 'self'`. No `X-Frame-Options` or `frame-ancestors` that would block a
`chrome-extension://` parent: the page is designed to be framed by the extension. No analytics, no
cookies, no third-party scripts besides Turnstile: this page is a bot check, and every extra script
is attack surface on the one origin the extension listens to.

## 5. Extension contract

### 5.1 Ownership and triggers

The service worker is the sole owner of enrolment, as it is of minting. UI realms never enrol; they
host the frame when asked and send a request message when onboarding completes; the worker decides.
The offscreen document cannot participate (its `chrome.storage.session` is poison-pilled).

Triggers, in order of expected frequency:

1. **Wallet onboarding completes.** The UI realm sends `INTEGRITY_ENROL_REQUEST` to the worker.
   Enrolment runs here, not lazily: fee delegation is the zero-balance onboarding path and often the
   user's first action, so a lazy check would land mid-transaction.
2. **Attest answers `403 APP_INTEGRITY_ENROLMENT_REQUIRED`.** Marker lost or the backend started
   enforcing. Re-enrol with the existing key.
3. **Attest answers `403 APP_INTEGRITY_REVOKED`.** Clear the key and the marker, generate a new key,
   enrol. The only time a user could see a second check.

Enrolment must not require an unlocked vault: it touches only the `pera-integrity` IndexedDB, the
frame host in an extension page, `chrome.tabs` for the fallback, and `fetch`.

### 5.2 Surfaces: hidden iframe first, tab as fallback

The default surface is an iframe of the check page inside an extension page, kept visually hidden
(fixed position, 1 by 1 pixel, opacity 0, pointer events off; never `display: none`, which would
stop the widget from running). For the large majority of installs the solve completes there and the
user sees nothing. The frame becomes a centred 440 by 560 modal only when the page reports
`interactive-required`, and collapses again on `interactive-done`, `solved` or `error`.

The host is the extension page that triggered enrolment: the expanded tab during onboarding. Its
overlay must render above every other app overlay (post-onboarding promo, PIN nudge), or enrolment
must wait until those are dismissed; a checkbox hidden under another dialog is a stuck enrolment.

A new tab (`chrome.tabs.create`, returning focus to the opener when closed) is the fallback, used
only when:

- no extension page is open to host the frame (a re-enrolment triggered while only the toolbar
  popup is open, which closes on focus loss and cannot host a long-lived frame);
- the frame never reports `ready` within 5 seconds (page blocked, offline, or a CSP or
  frame-ancestors regression on the web side);
- the page reports `TURNSTILE_BLOCKED`.

The relay and the worker logic are identical for both surfaces; only where the page is mounted
differs.

### 5.3 Single flight and lifecycle

- `navigator.locks.request('pera-integrity-enrol', ...)`, the same pattern as the mint lock, so
  popup plus expanded tab cannot start two enrolments.
- Mount the frame (or open the fallback tab), remember which, and register `chrome.tabs.onRemoved`
  for a fallback tab.
- Wait for `solved` or `error` on the port, with an overall deadline of 4 minutes: inside
  Turnstile's 300-second token life, leaving time for the enrol call.
- On `solved`: `POST /integrity/enrol`. On 200, persist the marker, hide the frame or close the
  tab, clear backoff. On 4xx, hide or close and record a failure. On a network error, retry the
  POST once immediately and then stop: the token is single-use, so a second server-side attempt
  after a 5xx that actually processed it fails, and that failure means "check again on the next
  trigger".
- On `error`, tab closed, or deadline: abort, release the lock, record a failure.

Enrolment can become visible, so it must never loop. At most one automatic attempt per trigger,
with exponential backoff between triggers (floor 5 minutes, cap 24 hours) persisted in
`chrome.storage.session` like the mint backoff. A user-initiated retry bypasses the backoff.

### 5.4 Relay and validation

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
    "all_frames": true
}
```

`all_frames: true` is what makes the iframe surface work; the same script serves the fallback tab.
`host_permissions` already covers `https://*.perawallet.app/*`. No new permission:
`chrome.tabs.create`, `chrome.tabs.remove` and `chrome.tabs.onRemoved` work without the `tabs`
permission.

The content script listens for the page's `postMessage` (same-origin only), acknowledges with a
`pera:integrity-check` / `ready` event so the page can detect the extension, and forwards over
`chrome.runtime.connect({ name: 'pera-integrity-check' })`:

```ts
type IntegrityCheckPortMessage =
    | { type: 'INTERACTIVE_REQUIRED'; v: 1; kid: string }
    | { type: 'INTERACTIVE_DONE'; v: 1; kid: string }
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
3. An enrolment is pending, started by this worker, whose `kid` equals the message's `kid`, and the
   port's `sender.tab.id` equals the tab hosting the frame or the fallback tab the worker opened.
4. `turnstileToken` is a non-empty string of at most 2048 characters.

`INTERACTIVE_REQUIRED` only ever expands the frame; the page cannot use it to make the extension do
anything else, and a hostile page that fakes it merely shows itself. The page stays untrusted after
these checks: the token is only ever forwarded to the backend, whose `siteverify` result is the
actual gate.

### 5.5 Storage

In the `pera-integrity` IndexedDB, beside the install key, a record `enrolment` =
`{ kid, enrolledAt }`. The worker treats "marker present and `kid` matches the current key" as
enrolled. A key regenerated for any reason invalidates the marker by construction.

### 5.6 Revocation handling in the mint loop

The mint loop distinguishes attest 403s by `code`: `APP_INTEGRITY_ENROLMENT_REQUIRED` keeps the key
and re-enrols; `APP_INTEGRITY_REVOKED` clears key and marker, then re-enrols; any other 403 clears
the key and lets the next attempt start clean. Both re-enrolments go through section 5.3's backoff,
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
  by ops action and by whatever abuse signal the fee-delegation service produces.

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

1. **Hidden iframe first, expanded only on interaction, tab as fallback.** With `interaction-only`
   the widget renders nothing for most solves, so a hidden frame gives a zero-UI enrolment;
   `before-interactive-callback` is the signal to expand it. A tab or popup window would flash a
   surface open and closed for every user to cover the minority who need a click. The trade: an
   iframe under a `chrome-extension://` page gets partitioned storage, so Turnstile's clearance may
   not carry across sessions and the interactive rate may be higher than in a tab. Enrolment is
   once per install, so that costs at most one extra click for some users; the rate is measured on
   staging with real keys before production.
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
7. **Backoff is per trigger with a 24-hour cap.** Enrolment can show UI; a mint-style 60-minute cap
   would surface the check hourly to a user whose enrolment keeps failing.
8. **`remoteip` is informational.** Requiring the enrol request IP to match the page load would break
   users on dual-stack or rotating mobile networks for no gain the key binding does not already give.

## 8. Rollout order

The pieces have to land in this order, because each is tested against the one before it:

1. Web: check page on the staging host with the staging sitekey, frameable by the extension.
2. Backend: `enrol` endpoint, table, `siteverify`, tests against the test secret; enforcement off.
3. Extension: content script, relay, frame host, worker flow, marker, revocation codes.
4. Staging soak with enforcement off, watching enrolment counts, error codes, and how often
   `interactive-required` fires from the framed page.
5. `APP_INTEGRITY_WEB_REQUIRE_ENROLMENT` on staging, then production.
