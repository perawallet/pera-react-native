# Browser Extension — Review Follow-ups

Tracked follow-up work from the `wjbeau/extension` code review. Items already
landed on the review branch are **not** listed here — see git history. This
document is the backlog for a **follow-up PR**; each item is self-contained with
file references and concrete steps so it can be executed in one pass.

Suggested order: **Security → Deep reviews → Comment cleanup → Refactors →
Minor**. Security items are the only ones that gate a release.

---

## 1. Security fixes (from the platform-chrome dapp-surface review)

The dapp surface is sound overall — every dapp action is authorized off the
browser-stamped `sender.origin`, never a page-asserted field, and
what-you-see-what-you-sign holds. No critical/high remotely-exploitable bug was
found. These three are the actionable findings.

### 1.1 [MEDIUM] Bind toolbar-popup approvals to a `requestId`

- **File:** `extensions/platform-chrome/src/dapp/approval-bridge.ts:305-317`
- **Problem:** `get-current-approval` returns whichever pending approval was
  inserted last, with no `requestId` binding. The toolbar-popup path
  (`openViaPopupOrWindow` → `tryOpenActionPopup`) opens the popup with no
  `requestId`, so it discovers "the" pending approval via this call. With two
  concurrent approvals from different origins, the popup can render origin B's
  request under a click the user initiated for origin A (approval-context /
  intent confusion). Blast radius is limited to "user authorizes an origin they
  didn't mean to," not silent key access (each request is still bound to its own
  origin/`requestId`), and the dedicated `approval.html?requestId=…` window path
  is already id-bound.
- **Fix:** Stamp the `requestId` onto the popup context (write a short-lived
  "current pending id" the popup reads), OR refuse to open a second popup-path
  approval while one is in flight so `get-current-approval` can never be
  ambiguous.

### 1.2 [MEDIUM] Narrow the Discover/Bidali content-script injection

- **Files:** `apps/extension/manifest.json:42-69`,
  `apps/extension/src/content/discover-main.ts:93-114`,
  `extensions/platform-chrome/src/webview/bridge-host.ts:43-53`
- **Problem:** The Discover/Bidali pair injects into **all frames** of wildcard
  `https://*.perawallet.app/*` and `https://*.bidali.com/*`, exposing
  `getAddresses`/`getAuthorizedAddresses`/`walletConnect`/`pushWebView`/etc. The
  bridge token is read from `location.search`, so it is page-readable; the real
  gate is exact-match origin membership in `trustedOrigins`. Any XSS,
  open-redirect, or embedded third-party subframe on _any_ `*.perawallet.app`
  subdomain that carries the token could enumerate accounts or drive the bridge.
- **Fix:** (a) `all_frames: false` for the Discover/Bidali pairs unless nested
  frames genuinely need the bridge; (b) narrow the manifest match to the
  specific Discover/Bidali hosts rather than the wildcard; (c) keep the origin
  allowlist as the primary gate but treat the per-mount CSPRNG token as
  defense-in-depth, not the sole secret.

### 1.3 [LOW/MED] Validate URL scheme in Bidali `openUrl` / Discover `openSystemBrowser`

- **Files:** `apps/extension/src/content/bidali-main.ts:106-113`,
  `apps/extension/src/content/discover-main.ts:98`
- **Problem:** An arbitrary page-supplied `url` string is forwarded to the host
  with no scheme validation. If the host sink opens it unguarded, a hostile page
  could pass `javascript:`, `file:`, `chrome-extension://…`, or a deep link.
- **Fix:** Enforce an `https:`/`http:` allowlist at this content-script boundary
  **and** verify the host-side open sink (outside platform-chrome — locate and
  confirm it) does the same.

---

## 2. Outstanding deep reviews (not completed — usage limit)

### 2.1 keystore-chrome deep review

Not completed. Confirmed only that `extensions/keystore-chrome` **does** depend
on `@algorandfoundation/keystore` (supports the reuse hypothesis). Still needed:

- **Reuse vs duplication:** can this import the upstream keystore and override
  only (a) a chrome.storage shim and (b) the WebAuthn glue, rather than
  reimplementing generic keystore logic? Read all of `extensions/keystore-chrome/src`
    - its `package.json`; determine what is genuinely chrome-specific vs inherited.
- **Cryptography:** enumerate every crypto op (KDF params, cipher mode, IV/nonce
  and salt handling, MAC/authentication, RNG). Flag anything hand-rolled, weak
  params, IV reuse, unauthenticated encryption, non-constant-time compares.
  Confirm known-answer / round-trip test coverage.
- **Secret-material hygiene:** verify `zeroBytes` is called on every secret
  `Uint8Array` after use and that no secret material (mnemonic, private key,
  seed, derived key, password) crosses the keystore boundary, is logged, or is
  persisted unencrypted. List file:line violations.

### 2.2 Lute Wallet's ledger-algorand-js fork

Identified the fork as **`acfunk/ledger-algorand-js`** (a fork of Zondax's
library). Not completed: diff the fork against upstream Zondax to identify the
actual bug fix (candidates: APDU chunking/tx-size, blind-signing, clearsigning),
then compare against Pera's current Ledger dependency (in `extensions/ledger-*`
/ `packages/ledger` / `packages/hardware-wallet` package.json) to decide: already
fixed / adopt Lute's fork / fork our own / no action.

### 2.3 packages/passkeys — CBOR/WebAuthn libraries

Partial finding: the hand-rolled CBOR in `packages/passkeys` is **encode-only**
and lives only there. Still needed: full inventory of hand-rolled CBOR + WebAuthn
(attestation/authenticatorData/COSE) parsing; assess replacing with a vetted
library given the **RN + extension + service-worker/offscreen** constraint that
rules out DOM-only libs. Evaluate cbor candidates (`@levischuck/tiny-cbor`,
`cbor-x`, `cbor2`) for RN-safety (pure-JS, no Node built-ins) and
`@simplewebauthn/*` / COSE libs for raw off-DOM parsing. Lean toward vetted libs
for any parsing of untrusted authenticator data unless a hard blocker exists.

---

## 3. Comment cleanup (started — ~42 files remain)

**Rule:** comments must never reference implementation-process milestones or
tasks (`M1`–`M12`, `Milestone N`, `Task N`, `T8`, "final-review mandate", etc.).
At most a real bug ticket (`PERA-1234`) is allowed. Reword sentences to keep the
technical WHY and drop the provenance (fix grammar — no dangling fragments);
delete comments whose only content is provenance. Also remove
obvious/redundant/outdated comments that restate the adjacent code; keep terse
WHY/constraint/security-rationale comments. Never touch license headers.

**Already cleaned:** `apps/mobile/src/routes/capabilities.web.ts`,
`apps/mobile/src/App.web.tsx`.

**Remaining files with milestone/task references** (regenerate exact lines with:
`grep -rnE '\b(M[0-9]+|[Mm]ilestone|Task [0-9]+|T[0-9]+ )\b' <file>`):

```
apps/extension/src/background/index.ts
apps/extension/src/content/bidali-main.ts
apps/extension/src/content/webauthn-main.ts
apps/extension/src/content/webview-relay.ts
apps/extension/web-shims/react-native-webview.js
apps/mobile/metro.config.js
apps/mobile/src/components/QRScannerView/QRScannerView.web.tsx
apps/mobile/src/constants/user-preferences.ts
apps/mobile/src/hooks/useDeepLink.ts
apps/mobile/src/modules/banners/index.ts
apps/mobile/src/modules/bottom-sheet/store/bottomSheetStore.ts
apps/mobile/src/modules/dapp/hooks/useDappRequest.ts
apps/mobile/src/modules/dapp/screens/EnableRequestScreen/EnableRequestScreen.tsx
apps/mobile/src/modules/dapp/screens/PasskeyApprovalScreen/usePasskeyApproval.ts
apps/mobile/src/modules/dapp/screens/SignRequestApprovalScreen/useSignRequestApprovalScreen.ts
apps/mobile/src/modules/gift-card/hooks/bidali-events.web.ts
apps/mobile/src/modules/gift-card/hooks/useBidaliTransport.ts
apps/mobile/src/modules/gift-card/screens/BidaliWebViewScreen/bidali-url.web.ts
apps/mobile/src/modules/gift-card/screens/BidaliWebViewScreen/useBidaliWebViewScreen.ts
apps/mobile/src/modules/vault/hooks/useAutoLockActivity.ts
apps/mobile/src/modules/webview/components/PWWebView/PWWebView.web.tsx
apps/mobile/src/modules/webview/hooks/trusted-iframe-origins.web.ts
apps/mobile/src/offscreen/runOffscreenApp.ts
apps/mobile/src/routes/tab-screens.web.tsx
apps/mobile/src/useWebAppShell.ts
extensions/keystore-chrome/src/index.ts
extensions/keystore-chrome/src/storage-keys.ts
extensions/keystore-chrome/src/webauthn/keystore-signer.ts
extensions/platform-chrome/src/dapp/approval-bridge.ts
extensions/platform-chrome/src/dapp/approval-client.ts
extensions/platform-chrome/src/dapp/passkey-router.ts
extensions/platform-chrome/src/dapp/webauthn-router-protocol.ts
extensions/platform-chrome/src/database/host.ts
extensions/platform-chrome/src/index.ts
extensions/platform-chrome/src/services/stubs.ts
extensions/platform-chrome/src/storage-events.ts
extensions/platform-chrome/src/storage-proxy.ts
extensions/platform-chrome/src/trusted-sender.ts
extensions/platform-chrome/src/webview/bridge-host.ts
extensions/platform/src/test-utils/key-value-storage-contract.ts
packages/passkeys/src/authenticator/authenticator.ts
packages/passkeys/src/index.ts
packages/passkeys/src/webauthn.ts
```

**Watch-outs:**

- Security files (`trusted-sender.ts`, `database/host.ts`, `storage-proxy.ts`,
  `approval-bridge.ts`): the "M4 threat model:" comments carry real security
  rationale — drop only the `M4` token, keep the whole explanation.
- `extensions/platform-chrome/src/services/stubs.ts:48` "…arrives with the vault
  in milestone 2" → reword to a milestone-free statement of what provides it.
- After cleaning, this grep over the changed set must return nothing:
  `\b(M[0-9]+|[Mm]ilestone|Task [0-9]+|T[0-9]+ )\b` (in comments).

Broader pass (obvious/redundant comments beyond milestone refs) was not started —
do it in the same sweep per the rule above.

---

## 4. Recommended refactors (assessed — worth doing, not blocking)

### 4.1 Extract ARC-0027 into a platform-agnostic package

- **Why:** A duplicate copy already exists (the `arc0027-*.ts` files carry
  "verbatim from packages/liquid-auth… dedupe when that branch merges" headers).
  Mobile Liquid Auth will want it too.
- **What:** New `packages/arc-0027` holding `arc0027-types.ts` + `arc0027-codec.ts`
    - `arc0027-errors.ts` + the `DappRequestRouter` core + `router-protocol.ts` +
      a storage-agnostic permission-store interface. Keep the chrome transport
      binding (`onMessage`/`sender.origin` glue, `ApprovalWindowBridge`) in
      platform-chrome; mobile supplies a WebRTC/CBOR transport later.
- **Effort:** ~1 day (mostly file moves + defining `LocalStorageArea` /
  `ApprovalOpener` ports). Depends on 4.2.

### 4.2 Split the `ApprovalOpener` interface

- **File:** `extensions/platform-chrome/src/dapp/router.ts:41-75`
- **What:** Split the combined interface into `Arc0027ApprovalOpener` +
  `PasskeyApprovalOpener` (one `ApprovalWindowBridge` implements both). Removes
  `passkey-router.ts`'s import from `router.ts` and unblocks 4.1 without dragging
  passkey types into the arc-0027 package. Move `PendingApproval`'s passkey arms
    - `PasskeyDecision` into a `dapp/passkey-*` module. Half-day, no runtime change.
- **Do NOT** split dapp/webauthn into separate extensions — they intentionally
  share one approval window, keystore, and SW; separating multiplies attack
  surface for no isolation benefit (same trust domain).

### 4.3 Ledger web provider — `pera-provider.web.ts` twin

- **What:** Add `extensions/provider/src/pera-provider.web.ts` (copy of
  `pera-provider.ts`) importing `WithLedgerWebBleExtension` /
  `WithLedgerWebUsbExtension` directly under their real names. Add both as
  `workspace:*` deps to `extensions/provider/package.json`. Then delete
  `apps/extension/web-shims/ledger-react-native.js` +
  `ledger-react-native-usb.js` and the two ledger entries in `apps/mobile/
metro.config.js` `webStubs` (lines ~82-85). Metro resolves provider from
  source, so `.web.ts` is picked on web — fully typechecked, replacing the
  untyped rename shims. Hoist the shared `PeraProvider` type so the twins can't
  drift.
- **Verify:** extension web bundle contains no
  `@ledgerhq/react-native-hw-transport-ble` / `react-native-ble-plx` /
  `@ledgerhq/react-native-hid`, and a Ledger connect flow still registers both
  transport providers.
- **Independent follow-up:** extract `ledger-react-native/src/protocol.ts`
  (platform-agnostic types) into a neutral `ledger-protocol` package so web
  packages stop depending on an RN-named package.

### 4.4 Unified "Connections" settings (web)

- **What:** New capability-gated (`connectionsSettings`) sectioned screen on web
  that lists WalletConnect sessions **and** dapp connections with a type badge,
  superseding both current menu entries. Keep the two data sources separate
  (Zustand `wallet-connect-store` vs TanStack-Query over `chrome.storage.local`
  dapp permissions) — union at the presentation layer only. Do **not** simply
  hide WC on web (it would strand live, un-revocable WC sessions). Mobile is
  untouched via the capability system. ~1-2 days. Add Liquid Auth as a third
  adapter when it lands.

### 4.5 Bidali/Discover handshake preamble (optional)

- **What:** Extract the ~25-line MAIN-world handshake preamble duplicated in
  `apps/extension/src/content/discover-main.ts:26-51` and `bidali-main.ts:48-72`
  into a `connectWebviewMainChannel(eventPrefix)` helper next to
  `webview-relay.ts`. While there, rename the `DISCOVER_*` wire constants in
  `extensions/platform-chrome/src/webview/bridge-wire.ts` to neutral
  `WEBVIEW_BRIDGE_*` (keep the runtime string values — they're wire-compatible)
  and delete the justification comments this enables. Low value, low risk; do
  not merge the provider surfaces themselves (they mirror two different contracts).

---

## 5. Minor / optional

- **Confirm `pera_web` user-agent token is allowlisted.** device.ts now emits a
  UA mirroring mobile's format but with `pera_web_<version>` as the trailing
  platform token (mobile uses `pera_ios`/`pera_android`). Verify Cloudflare /
  backend rules (rate limiting, etc.) accept `pera_web`, or they may reject
  extension traffic. See `extensions/platform-chrome/src/services/device.ts`
  `getUserAgent()`.
- **node-crypto shim test.** `apps/extension/web-shims/node-crypto.js` is a sound
  adapter over `@noble/hashes` + WebCrypto (keep it — do not swap for
  crypto-browserify). Optional hardening: add a spec in `web-shims/__tests__/`
  asserting `createHash`/`createHmac`/`pbkdf2`/`randomBytes` byte-match Node's
  `node:crypto` under vitest, to lock the adapter plumbing.
