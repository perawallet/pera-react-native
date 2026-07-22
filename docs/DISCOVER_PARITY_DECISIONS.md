# Discover / In-App Browser — Ratified Parity Divergences

Records the intentional differences between the React Native in-app browser
(`PWWebView` / Discover) and the legacy native apps (`pera-ios`, `pera-android`),
so they read as deliberate product/architecture choices rather than gaps.

Origin: audit PERA-4547, epic PERA-4664 (IAB-011 / PERA-4675). Findings P-5, P-6,
P-7, M-5.

Sibling records from the same epic (each lands with its own ticket):

- [DISCOVER_BRIDGE_CONTRACT.md](./DISCOVER_BRIDGE_CONTRACT.md) — bridge method
  contract (IAB-008 / PERA-4672).
- [DISCOVER_AUTH_AND_COOKIES.md](./DISCOVER_AUTH_AND_COOKIES.md) — Basic-auth and
  cookie-isolation posture (IAB-009 / PERA-4674).
- [WEBVIEW_TLS_PINNING.md](./WEBVIEW_TLS_PINNING.md) — why WebView TLS pinning is
  deferred (S-9 / PERA-4669).

> **Status:** proposed — awaiting product sign-off. Each row's "Decision" is the
> recommended ratification; mark `Ratified` (with owner + date) once confirmed, or
> open a linked follow-up ticket if reversed.

## P-5 — External-redirect allow-list not ported

**Native (iOS):** routes external redirections through a mobile-API allow-list
(`DiscoverURLGenerator.swift` → `/v1/discover/redirect-if-allowed/`). **RN:** loads
an external `https` URL directly.

**Decision (recommend ratify — don't port):** the allow-list exists to vet targets
that arrive from outside the trusted origin, and RN has no such entry point. Every
browsing URL comes from the Discover web app via `pushWebView` (see P-7 — no
address bar), those targets are https-only (IAB-001 / PERA-4667), and the live host
label from IAB-001 (PERA-4665) covers the "what am I looking at" need. Porting it
would put a backend round-trip in front of every external navigation — added
latency plus a new failure mode when the endpoint is unavailable — to re-check URLs
the trusted origin already chose.

**If reversed:** follow-up ticket to call `redirect-if-allowed` before external
loads, with an explicit policy for endpoint failure (fail-open loses the benefit,
fail-closed breaks browsing when the API is down).

Recorded here because IAB-010 (PERA-4673) ports only P-2 (social-media routing);
its ticket folds an un-ported P-5 into this record.

## P-6 — Native asset-search UI replaced by web search

**Native:** both apps ship a native search overlay (throttled asset-search API,
trending, pagination, verification-tier icons). **RN:** the `discover` module has
no search screen; search is delegated to the Discover web app.

**Decision (recommend ratify):** keep web-delegated search. It is functionally
preserved, keeps a single source of truth for search/ranking on the web side, and
removes a native surface that would otherwise have to track the web app's ranking
changes. No account-security dimension.

**If reversed:** follow-up ticket to reintroduce a native search screen in
`modules/discover` (throttled query hook + verification-tier rendering).

## P-7 — No native URL / address bar in RN

**Native:** external browser accepts typed / handed URLs via a live address bar.
**RN:** every browsing URL enters through the trusted Discover web app via
`pushWebView`; there is no free-form address entry.

**Decision (recommend ratify — security-positive):** keep the no-address-bar
model. This is a deliberate hardening, not a missing feature: with no free-form
entry, **every** loaded URL originates from the trusted Discover origin, which is
exactly what lets the bridge hold a single-exact-origin `requireSecure` trust
model. An address bar would let arbitrary origins into a bridge-enabled WebView
and widen the trust surface the rest of this epic is tightening. The live host
label added in IAB-001 (PERA-4665) covers the "where am I" need that an address
bar would otherwise serve.

**If reversed:** any address-bar reintroduction MUST keep typed-URL loads in a
non-bridge (untrusted) WebView context and is a security-review-gated follow-up.

## M-5 — Legacy `fallbackBrowserGroupResponse` / tab-group association dropped

**Native:** an in-app-browser dapp-to-tab-group association exists; the legacy
import payload carries `fallbackBrowserGroupResponse` on both WC session types.
**RN:** the field is read by nothing; per-session browser tab-groups are not
reconstructed. (Browser history / recent / pinned were never migratable data.)

**Decision (recommend ratify):** do not reconstruct tab-groups. RN's browser is a
single-context Discover surface, not a multi-tab manager, so there is no tab-group
model to import into. The `fallbackBrowserGroupResponse` decode is intentionally
ignored — see also the WC-v2 non-migration decision (PERA-4671), which documents
the same payload as diagnostic-only.

**If reversed:** follow-up ticket to design a tab-group model first; the legacy
payload field can then feed it.

## Sign-off

| Finding | Decision                   | Ratified by | Date | Follow-up (if reversed) |
| ------- | -------------------------- | ----------- | ---- | ----------------------- |
| P-5     | No redirect allow-list     | _pending_   |      |                         |
| P-6     | Web-delegated search       | _pending_   |      |                         |
| P-7     | No address bar (hardening) | _pending_   |      |                         |
| M-5     | No tab-group restoration   | _pending_   |      |                         |
