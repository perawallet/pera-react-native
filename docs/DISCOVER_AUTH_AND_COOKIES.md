# Discover Origin — Auth Header & Cookie Isolation Decisions

Records the request/session-posture decisions for the Discover origin in the
React Native in-app browser, versus the legacy native apps.

Origin: audit PERA-4547, epic PERA-4664 (IAB-009 / PERA-4674). Findings P-3, P-4.
Companion to the WebView hardening in IAB-004 (PERA-4668).

Sibling records from the same epic (each lands with its own ticket):

- [DISCOVER_BRIDGE_CONTRACT.md](./DISCOVER_BRIDGE_CONTRACT.md) — bridge method
  contract (IAB-008 / PERA-4672).
- [DISCOVER_PARITY_DECISIONS.md](./DISCOVER_PARITY_DECISIONS.md) — ratified parity
  divergences (IAB-011 / PERA-4675).
- [WEBVIEW_TLS_PINNING.md](./WEBVIEW_TLS_PINNING.md) — why WebView TLS pinning is
  deferred (S-9 / PERA-4669).

> **Status:** blocked on external input. P-4 needs an infra/backend answer before
> any code lands; P-3 is an in-repo decision recorded below. No speculative auth
> plumbing is added under this ticket — a header wired "just in case" would ship
> an empty credential and imply an auth model that may not exist.

## P-4 — Discover HTTP Basic-auth header (BLOCKED on infra)

**Native (Android):** attaches `Authorization: Basic <base64(user:pass)>` to
Discover page loads (`DiscoverUtils.getDiscoverAuthHeader`, creds from
`DISCOVER_WEBVIEW_USERNAME/PASSWORD` build config). **iOS/RN:** attach **no**
header — RN's `source={{ uri }}` carries no `customHeaders`.

**Open question (owner: infra/backend):** does the `discover-mobile` deployment
that RN targets (staging + prod) sit behind Basic auth, or is it a separate,
unauthenticated deployment?

- **If auth is required:** attach the header on the Discover load **only** for the
  trusted origin, in `useDiscoverScreen` / the Discover `PWWebView` via
  `source={{ uri, headers }}`, with creds injected from `config` at build time
  (bitrise secrets / env — never committed, same pattern as other first-party
  secrets). It MUST NOT reach `pushWebView`-opened dapps — scope the header to the
  exact Discover URL, and drop it on any navigation away from the trusted origin.
- **If no auth is required:** record that the RN deployment is intentionally
  unauthenticated and close P-4 with no code.

**Do not implement until this is answered.** A blank/`""` Basic header is worse
than none.

## P-3 — Cookie isolation between sessions

**Native (Android):** clears all cookies on every WebView init
(`CookieManager.removeAllCookies()` + `flush()`). **iOS/RN:** persistent, shared
cookie/data store; no cookie clearing anywhere in `apps/mobile/src`.

**Decision (recommend ratify): disabled third-party cookies now; defer a
full per-session wipe.** Rationale:

1. The concrete tracking concern is **cross-site** cookies, which IAB-004
   (PERA-4668) already closes by pinning `thirdPartyCookiesEnabled={false}` on
   `PWWebView` — no cross-dapp third-party tracking cookie survives.
2. Favorites and all device-keyed state are **server-side** (`device_id`-keyed),
   not cookie-backed, so a persistent first-party jar has no correctness benefit
   to protect and its loss would not affect favorites.
3. A blanket `removeAllCookies()` on init (Android's model) or `incognito` for
   untrusted loads is a real behavior change that can break the Discover origin's
   own first-party session and must be validated on-device on **both** platforms
   before shipping — it is not a safe blind port.

**Follow-up (only if product wants Android-parity wiping):** add an
`incognito`/non-persistent store for `pushWebView`-opened (untrusted) dapp loads
while keeping Discover's first-party session persistent, and device-verify that
Discover login/session still works with third-party cookies already off. Scope it
as its own ticket with a device-test matrix; compose with IAB-004.

## Sign-off

| Finding        | Decision                                                                     | Owner         | Date      |
| -------------- | ---------------------------------------------------------------------------- | ------------- | --------- |
| P-4 Basic auth | Blocked — infra to confirm `discover-mobile` auth model                      | infra/backend | _pending_ |
| P-3 cookies    | Third-party off (IAB-004); full wipe deferred to a device-verified follow-up | product       | _pending_ |
