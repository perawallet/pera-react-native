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
    participant Page as Extension page (popup or expanded tab)
    participant SW as Extension service worker
    participant Frame as Check page iframe (perawallet.app)
    participant CF as Cloudflare Turnstile
    participant BE as Backend

    Page->>SW: pera-integrity-enrol request (page open, onboarding finished, enrolment needed)
    SW->>SW: not enrolled on this network, no live attempt, no backoff
    SW->>SW: kid = base64url(sha256(SPKI of install public key)), fresh token
    SW-->>Page: host (url with kid and token)
    Page->>SW: hold host port pera-integrity-host:token
    Page->>Frame: mount iframe, visually hidden
    Frame->>Frame: content script answers the page's hello with ready
    Frame->>SW: PAGE_READY on pera-integrity-check:token
    Frame->>CF: render widget (action, cData = kid, interaction-only)
    alt Cloudflare needs a click
        Frame->>Page: expand (content script, window.parent.postMessage)
        CF-->>Frame: user clicks, token
    else invisible
        CF-->>Frame: token
    end
    Frame->>SW: TURNSTILE_SOLVED on the check port
    Frame->>Page: finished, and the page removes the frame
    SW->>SW: port origin and path, token and kid match the live attempt
    SW->>BE: POST /api/v3/public/integrity/enrol (device_id, public_key, turnstile_token)
    BE->>CF: siteverify (secret, token)
    CF-->>BE: success, action, cdata, hostname, challenge_ts
    BE->>BE: action and cdata == kid(public_key) and hostname allowed; store enrolment
    BE-->>SW: 200 enrolled
    SW->>SW: persist this network's marker, mark the attempt done
    SW-->>Page: attempt over (session storage change), page releases the host port
```

The mint loop never blocks on enrolment. Minting works un-enrolled until the backend enforces
enrolment (section 6.4); enrolment is a prerequisite the backend enforces and the client reacts to.

## 4. Page contract (web)

### 4.1 Location and environments

| environment | check page                                       | Turnstile sitekey                               |
| ----------- | ------------------------------------------------ | ----------------------------------------------- |
| production  | `https://integrity.perawallet.app/check`         | one widget whose allowlist holds both hosts     |
| staging     | `https://integrity-staging.perawallet.app/check` | the same widget, so the same sitekey and secret |
| local       | `localhost`, for the page's own tests            | Cloudflare test sitekeys                        |

Test sitekeys: `1x00000000000000000000BB` passes invisibly, `1x00000000000000000000AA` passes
visibly, `3x00000000000000000000FF` forces the checkbox, `2x00000000000000000000AB` always fails. On
`localhost` the page takes a `sitekey` query parameter so an e2e run can pick one.

Each extension build frames and accepts exactly one check-page origin, chosen by its app environment
(`integrityCheckOrigin` in `packages/config/src/main.ts`): a development build uses the staging
page, so a `localhost` page never reaches the extension.

Sharing one secret means `siteverify` accepts a staging solve under the production secret, so the
backend's hostname check (section 6.2) is what keeps a staging solve from enrolling in production.
Each environment's `TURNSTILE_ALLOWED_HOSTNAMES` must name its own host only.

A dedicated subdomain rather than a path on the marketing site: the extension's content script must
match this origin exactly, the page needs its own strict CSP, and the host doubles as the Turnstile
hostname allowlist entry. The pair follows the existing `discover-mobile` / `discover-mobile-staging`
split.

### 4.2 Request URL

```
https://integrity.perawallet.app/check?v=1&kid=<base64url sha256 of SPKI DER>&peraCheckToken=<token>&lang=<BCP-47>
```

- `v`: contract version. The page refuses unknown versions with the `UNSUPPORTED_VERSION` error.
- `kid`: 43 characters, base64url without padding (`[A-Za-z0-9_-]`), which is exactly Turnstile's
  `cData` alphabet. This is the binding value; the page validates the shape and puts it in `cData`
  verbatim.
- `peraCheckToken`: 16 random bytes, base64url, minted by the worker for each attempt (section 5.3).
  Only the extension's content script reads it (section 5.4); the page ignores it, as it ignores any
  parameter it does not know.
- `lang`: optional, for the page's own copy, and ignored for any language the page has no
  translation for: tagging English text with another language makes screen readers mispronounce it.
  Turnstile picks the browser language itself.

Nothing personal is in the URL: the installation id never leaves the extension, and the token
authenticates nothing outside its one attempt. The page behaves the same whether it is framed or
opened as a tab; it does not need to know which.

### 4.3 Widget configuration

```js
turnstile.render('#check', {
    sitekey: SITEKEY_FOR_THIS_HOST,
    action: 'pera-extension-enrol', // fixed; the backend requires this exact value
    cData: kidFromQuery, // the binding
    appearance: 'interaction-only', // nothing rendered unless Cloudflare needs a click
    'refresh-expired': 'manual', // the extension owns retries, not the widget
    'feedback-enabled': false, // its error report is a beacon the page's connect-src forbids
    'before-interactive-callback': onInteractiveRequired, // the extension expands the frame
    'after-interactive-callback': onInteractiveDone,
    callback: onSolved,
    'error-callback': onError, // returns true, or Turnstile also runs its own error handling
    'expired-callback': onExpired,
    'timeout-callback': onTimeout, // a shown checkbox nobody completed
    'unsupported-callback': onUnsupported,
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
origin relays to the service worker over a runtime port. Every message is
`{ type: 'pera:integrity-check', v: 1, event, kid, ... }`, posted to `window.location.origin`:

| `event`                | sent when                              | extra fields              |
| ---------------------- | -------------------------------------- | ------------------------- |
| `hello`                | the page script starts                 | none                      |
| `interactive-required` | Cloudflare is about to show a checkbox | none                      |
| `interactive-done`     | the checkbox was completed             | none                      |
| `solved`               | a token is ready                       | `turnstileToken`          |
| `error`                | the attempt failed                     | `code`, optional `detail` |

The content script answers `hello` with `{ type: 'pera:integrity-check', v: 1, event: 'ready' }` on
the same window. The page cannot simply wait for an unprompted `ready`: the content script runs at
`document_start`, before the page's script exists. Without a `ready` within 3 seconds the page shows
that it only works when opened by the Pera extension, and keeps running the widget. The content
script stays silent on a page opened without a well-formed `peraCheckToken`, so a direct visit never
gets `ready`.

`kid` is echoed only when well formed and is otherwise the empty string, so a malformed URL relays
nothing the page did not validate. Turnstile's own iframe traffic arrives on the same window, so the
content script must ignore any message whose `type` is not `pera:integrity-check`.

| `code`                | meaning                                                  | `detail`                                                                                            |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `TURNSTILE_BLOCKED`   | the script failed or had not loaded after 10 seconds     | `script-load-failed`                                                                                |
| `TURNSTILE_ERROR`     | the widget failed                                        | Cloudflare's code, or `render-failed`, `reset-failed`, `unsupported-browser`, `no-sitekey-for-host` |
| `TURNSTILE_EXPIRED`   | the token expired before pickup, or a checkbox timed out | none, or `interactive-timeout`                                                                      |
| `UNSUPPORTED_VERSION` | the page does not speak this `v`                         | none                                                                                                |
| `INVALID_KID`         | `kid` is not 43 base64url characters                     | none, and `kid` is empty                                                                            |

`UNSUPPORTED_VERSION`, `INVALID_KID` and `no-sitekey-for-host` cannot succeed on a retry; every
other error can.

While the widget is invisible the page renders nothing but its status text, so a hidden frame has
nothing to show. Once interaction is required the page shows the widget and a one-line explanation
("Quick check to verify you before using Pera"), plus a retry button on a retryable error.

### 4.5 CSP and hygiene

`default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src
https://challenges.cloudflare.com; connect-src 'self'; style-src 'self'; base-uri 'none';
form-action 'none'`, with a referrer policy that still sends the origin, because Cloudflare matches
it against the widget's hostname allowlist. No `X-Frame-Options` or `frame-ancestors` that would
block a `chrome-extension://` parent: the page is designed to be framed by the extension. No
analytics, no cookies, no third-party scripts besides Turnstile: this page is a bot check, and every
extra script is attack surface on the one origin the extension listens to.

## 5. Extension contract

### 5.1 Ownership and triggers

The service worker is the sole owner of enrolment, as it is of minting. Extension pages never
enrol: they ask, and the worker decides. The request is
`{ scope: 'pera-integrity-enrol', kind: 'request', reason }` over `chrome.runtime.sendMessage`; the
answer is `{ action: 'host', url, deadlineAt }` or `{ action: 'none' }`. Only a sender that passes
`isTrustedExtensionPageSender` can get `host`: content scripts share the listener. The offscreen
document cannot participate (its `chrome.storage.session` is poison-pilled).

The popup and the expanded tab ask once wallet onboarding is finished, so the key bound is that of
an install in use. The `reason` names the moment:

1. **`onboarding-complete`**: onboarding finishes in this page. Enrolment runs here, not lazily: fee
   delegation is the zero-balance onboarding path and often the user's first action, so a lazy check
   would land mid-transaction.
2. **`page-open`**: the page opens. This also reaches installs that onboarded before the extension
   could enrol.
3. **`enrolment-needed`**: the worker raised `integrity:enrol-needed` in `chrome.storage.session`,
   which open pages watch. An attest 403 only raises this flag (section 5.6), because the worker
   cannot address a page; an open page asks, and section 5.3 covers there being none.

The worker answers `none` when this network's marker matches the current key (section 5.5), while
an attempt is live, while backoff holds, and whenever either build flag is off (section 8).

Enrolment must not require an unlocked vault: it touches only the `pera-integrity` IndexedDB,
`chrome.storage.session`, the frame host in an extension page, `chrome.tabs` for the fallback, and
`fetch`. The frame host sits outside the vault gate, so locking never kills a check mid-solve.

### 5.2 Surfaces: hidden iframe first, tab as fallback

The default surface is an iframe of the check page inside the page that asked: the popup or the
expanded tab, never an approval window, which lives for one dApp request and closes itself. The
frame is kept visually hidden (1 by 1 pixel, opacity 0, pointer events off, `inert` so it is out of
the tab order and the accessibility tree; never `display: none`, which would stop the widget from
running). For the large majority of installs the solve completes there and the user sees nothing.
On `expand` (section 5.4) the frame becomes a centred 440 by 560 dialog, `collapse` hides it again,
and `finished` removes it.

The frame is portalled into the document body above every other overlay, toasts and modal portals
included: a checkbox hidden under another dialog is a stuck enrolment. It carries PWWebView's
sandbox allowances without top navigation (`allow-same-origin allow-scripts allow-forms
allow-popups`), so nothing in it can navigate the wallet page. The page frames only a URL on its
build's check origin, whatever the worker answers.

A new, focused tab (`chrome.tabs.create`) is the fallback, opened only while the page that asked
still holds its host port (section 5.4) and either:

- the frame sends no `PAGE_READY` within 5 seconds (page blocked, offline, or a CSP or
  frame-ancestors regression on the web side); or
- the frame reports `TURNSTILE_BLOCKED`.

A page that has closed gets no tab (section 5.3). The tab gets a fresh token, so a frame that loads
late cannot drive the attempt the tab now owns. The relay and the worker logic are otherwise
identical for both surfaces.

### 5.3 Attempt state and lifecycle

MV3 evicts an idle worker after 30 seconds and an interactive solve can take minutes, so an awaited
promise would not outlive the solve. The attempt is a record in `chrome.storage.session`
(`integrity:enrol-attempt`) with its token, `kid`, network, deadline, surface and a phase
(`checking`, `enrolling`, `done`), and a one-shot alarm (`pera-integrity-enrol-deadline`) enforces
the deadline.

- `navigator.locks.request('pera-integrity-enrol', ...)` serialises every read and write of the
  attempt, so popup plus expanded tab cannot start two enrolments.
- The enrol call goes to the backend of the network active when the attempt started.
- The deadline is 4 minutes: inside Turnstile's 300-second token life, leaving time for the enrol
  call. The host page hides its frame at the same `deadlineAt`.
- On `solved`: move to `enrolling`, then `POST /integrity/enrol`. If the install key no longer
  matches the attempt's `kid` (the mint loop dropped it mid-check), the attempt ends quietly with no
  POST and no failure, and the new key enrols on the next trigger. A 200 for the attempt's `kid`
  persists the marker, clears backoff and `integrity:enrol-needed`, and clears the mint backoff and
  mints at once, since under enforcement the mint that asked for enrolment backed off. Anything else
  records a failure, and a `409 PUBLIC_KEY_IN_USE` also drops the install key and the minted token,
  so the next attempt enrols a fresh key. The POST is retried only when no response arrived at all,
  and then once: the token is single-use, so a retry after a timeout or a 5xx the server may have
  processed can only fail, and that failure means "check again on the next trigger".
- On any other `error` in the frame (section 5.2 covers `TURNSTILE_BLOCKED`), a non-retryable
  `error` in the tab, or the deadline: end the attempt and record a failure. A retryable `error`
  (section 4.4) in the fallback tab keeps the attempt open until the tab goes or the deadline: the
  page's retry button is the user-initiated retry there, and an abort would let the page announce
  success for a token nobody is waiting for.
- The fallback tab closed or navigated elsewhere ends the attempt with a failure. The worker learns
  it from the tab's check port closing plus `chrome.tabs.get`, not from `chrome.tabs.onRemoved`,
  which would wake the worker on every tab close in the browser. A reload shows the check page again
  and reconnects with the same token; a tab closed while the worker was evicted is left to the
  deadline. Ending an attempt closes its tab only while the tab still shows the check page.
- A frame attempt still `checking` ends quietly once its page has gone, whether its last host port
  closes or none is held when the liveness check or `TURNSTILE_BLOCKED` arrives: no backoff and no
  tab, because nothing failed, and a closed popup must never open a tab the user did not stay for.
  With no page open nothing is shown; the next page to open hosts. Once the solve is in, closing the
  page changes nothing.

Enrolment can become visible, so it must never loop. At most one automatic attempt per trigger,
with exponential backoff between failures (floor 5 minutes, cap 24 hours) persisted in
`chrome.storage.session` (`integrity:enrol-backoff`) like the mint backoff.

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
`chrome.tabs.create`, `chrome.tabs.get` and `chrome.tabs.remove` work without the `tabs` permission,
and the host permission exposes a tab's `url` only while it shows our origin, which is exactly the
"still on the check page" test the worker needs.

The content script does nothing on a page without a well-formed `peraCheckToken`. Otherwise it
listens for the page's `postMessage` (same window and origin only, and only
`type: 'pera:integrity-check'`). On `hello` it answers the page with `ready`, opens
`chrome.runtime.connect({ name: 'pera-integrity-check:<token>' })` and sends `PAGE_READY`, the
worker's liveness signal for section 5.2. Every later event is forwarded on that port. An evicted
worker drops the port mid-solve, so the script reconnects on its next message and re-sends
`PAGE_READY` first.

```ts
type IntegrityCheckPortMessage =
    | { type: 'PAGE_READY'; v: 1; kid: string }
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

The worker disconnects the port unless all of these hold:

1. The port name is `pera-integrity-check:` followed by a well-formed token.
2. `port.sender.origin` is exactly this build's check-page origin (section 4.1; the browser stamps
   it, the page cannot forge it), and `port.sender.url` parses to that origin with pathname exactly
   `/check`, so `/checkout` on the same host is not the check page.
3. The token is the live attempt's, and the message's `kid` equals the attempt's.
4. The message parses: `v` is 1, and `turnstileToken` is a non-empty string of at most 2048
   characters.

The token takes the place of a `sender.tab.id` match: an iframe in the popup has no tab, so a tab
rule could never pass there. Only the extension page the worker answered knows the URL, and a fresh
token per attempt means a check page opened by anyone else cannot drive an enrolment. An
`INVALID_KID` error carries an empty `kid`, so it can never pass rule 3's `kid` match; it is
accepted on the token alone and ends the attempt, since that URL cannot succeed on a retry.

The hosting page holds a second port, `pera-integrity-host:<token>`, accepted only from extension
pages and counted per token; section 5.3 says what the last one closing does. The page keeps its
port after the frame reports `finished` until the worker marks the attempt over, so the solve cannot
lose a race with the port closing.

When framed, the content script tells the hosting page what to do with the frame directly, never
through the worker: `{ type: 'pera:integrity-frame', v: 1, event }` via `window.parent.postMessage`
to the extension origin, so a site framing the check page learns nothing. `event` is `expand` on
`interactive-required`, `collapse` on `interactive-done`, and `finished` on `solved` or `error`; it
never carries the token. The host accepts it only from its own iframe at the check origin, and a
hostile page that fakes `expand` merely shows itself. The page stays untrusted after these checks:
the token is only ever forwarded to the backend, whose `siteverify` result is the actual gate.

### 5.5 Storage

In the `pera-integrity` IndexedDB's `keys` store, beside the install key (`install-key`), one
marker per network: `enrolment:<network>` = `{ kid, enrolledAt }`. Per network because mainnet and
testnet are separate backend deployments with separate databases, so a key enrolled on one is
unknown to the other. The worker treats "this network's marker present and its `kid` matches the
current key" as enrolled. A key regenerated for any reason invalidates every marker by construction.

### 5.6 Revocation handling in the mint loop

The mint loop never enrols; it distinguishes attest 403s by `code` and raises
`integrity:enrol-needed` for section 5.1's third trigger:

- `APP_INTEGRITY_ENROLMENT_REQUIRED` keeps the key, clears only the active network's marker (the
  backend is the authority, whatever the marker says), and raises the flag. When that marker held
  the current `kid`, the backend contradicts an enrolment it accepted (replica lag, a defect), so
  it also records an enrolment failure: otherwise the successful enrol that just cleared the backoff
  would be followed at once by another solve.
- `APP_INTEGRITY_REVOKED` clears the key and the minted token, then raises the flag; the old
  markers die by their `kid`.
- Any other 403 clears the key and the token and lets the next mint start clean.

Every 403 also records a mint failure, and every re-enrolment goes through section 5.3's backoff,
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

| status | body                                                        | when                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | `{ "enrolled": true, "kid": "<base64url sha256 of SPKI>" }` | new enrolment or re-enrolment                                                                                                                                                          |
| `400`  | `{ "error", "code": "TURNSTILE_INVALID" }`                  | `siteverify` returned `success: false` (includes expired and already-used tokens)                                                                                                      |
| `400`  | `{ "error", "code": "TURNSTILE_BINDING_MISMATCH" }`         | `siteverify` `cdata` differs from `kid(public_key)`, or `action` differs from `pera-extension-enrol`, or `hostname` is not an allowed check page, or the solve is older than 5 minutes |
| `400`  | `{ "error", "code": "INVALID_PUBLIC_KEY" }`                 | SPKI does not import as ECDSA P-256                                                                                                                                                    |
| `409`  | `{ "error", "code": "PUBLIC_KEY_IN_USE" }`                  | the key is already enrolled under a different `device_id` (section 6.3)                                                                                                                |
| `503`  | `{ "error", "code": "TURNSTILE_UNAVAILABLE" }`              | `siteverify` unreachable; the client treats it as transient                                                                                                                            |

### 6.2 Verification

1. Validate shapes; import the SPKI with WebCrypto exactly as attest does; compute
   `kid = base64url(sha256(spkiDer))`.
2. Call `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` (env
   `TURNSTILE_SECRET_KEY`) and `response` (the token), with a 5-second timeout. No `remoteip`:
   behind the load balancer the address the service sees is not reliably the solver's.
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
  the client drops its key on that answer and enrols a fresh one on its next attempt (section 5.3).
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
7. **Enrolment backoff grows with each failure, capped at 24 hours.** Enrolment can show UI; a
   mint-style 60-minute cap would surface the check hourly to a user whose enrolment keeps failing.
8. **No `remoteip`.** The service cannot reliably see the solver's address behind the load
   balancer, and requiring the enrol request IP to match the page load would break users on
   dual-stack or rotating mobile networks for no gain the key binding does not already give.

## 8. Rollout order

The pieces have to land in this order, because each is tested against the one before it:

1. Web: check page on the staging host with the real sitekey, frameable by the extension.
2. Backend: `enrol` endpoint, table, `siteverify`, tests against the test secret; enforcement off.
3. Extension: content script, relay, frame host, worker flow, marker, revocation codes, behind the
   `WEB_INTEGRITY_ENROL_ENABLED` build flag (default off), which acts only with
   `WEB_INTEGRITY_MINT_ENABLED` on. It is its own flag because enrolment can show UI and minting
   cannot, so the rollout can turn them on separately.
4. Staging soak with both flags on and enforcement off, watching enrolment counts, error codes,
   and how often `interactive-required` fires from the framed page.
5. `APP_INTEGRITY_WEB_REQUIRE_ENROLMENT` on staging, then production.
