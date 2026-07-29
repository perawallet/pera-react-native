# WebView TLS Pinning for the Discover Origin

Decision record for PERA-4669 (audit finding S-9, PERA-4547): should the
in-app browser pin the TLS certificate/public key of the Discover origin
(`discover-mobile.perawallet.app`)?

**Decision: deferred.** No sound implementation path exists through
`react-native-webview` today, and Android WebView cannot implement pinning
against the actual threat at all. Rationale and follow-up scope below.

## Context

The app already pins its API traffic via `react-native-ssl-public-key-pinning`
(`extensions/platform-react-native/src/services/ssl-pinning/`): OkHttp
`CertificatePinner` on Android, TrustKit on iOS. Both mechanisms hook the
app's native HTTP stacks (OkHttp / `NSURLSession`) — **WebView traffic never
passes through either**. WKWebView loads pages in its own network process;
Android System WebView uses Chromium's network stack. The Discover origin is
served through the same Cloudflare front end as the API, so the existing pin
set (`pins.ts`, Cloudflare partner-CA roots) _would_ be reusable — but the
current config does not, and cannot, cover WebView loads.

## What the platforms support

### iOS — feasible natively, not exposed by the library

`WKNavigationDelegate webView:didReceiveAuthenticationChallenge:` receives an
`NSURLAuthenticationMethodServerTrust` challenge for every TLS handshake, so
SPKI-hash evaluation of the presented `SecTrust` chain against a pin set is
possible (this is how TrustKit supports WKWebView). `react-native-webview`
implements that delegate (`apple/RNCWebViewImpl.m`) but only for client
certificates, HTTP Basic credentials, and `customCertificatesForHost` — a
whole-certificate `SecCertificateCopyData` byte comparison against an
app-bundled certificate, intended for self-signed/custom CAs. Using it for
the Discover origin would pin the _leaf_ certificate, which Cloudflare rotates
with fresh keys roughly every 90 days — guaranteed breakage. There is no
JS-exposed hook for SPKI server-trust evaluation; implementing one means
patching or forking the library's native iOS code.

### Android — not soundly feasible at all

`WebViewClient.onReceivedSslError` only fires for certificates that **fail**
system chain validation. The S-9 threat is a MITM using a mis-issued or
rogue-but-trusted CA certificate — that certificate validates cleanly, so the
callback never fires and cannot be used to detect the attack.
`react-native-webview` handles the callback internally anyway (always
`handler.cancel()`, no JS hook). The known workaround — proxying every request
through a pinned OkHttp client via `shouldInterceptRequest` — loses POST
bodies, breaks service workers and streaming, and is widely discouraged;
the Chromium team explicitly does not support certificate pinning in Android
WebView.

## Rationale for deferring

- No `react-native-webview` surface for real pinning on either platform;
  shipping it means carrying patched native library code across upgrades.
- Android cannot be covered soundly, so the patch buys iOS-only protection —
  asymmetric coverage for a Low/Info-severity finding.
- Compensating controls already bound the exposure: single trusted origin over
  HTTPS, per-load bridge token (subframe-forgery defense), message-time origin
  validation (PERA-4669 part 1), and a signing surface that always goes
  through user-facing approval — a MITM gains read access to addresses and
  the device id, not silent signing.
- API pinning itself is treated as fail-open hardening (expiration backstop in
  `pins.ts`); a WebView pin would warrant the same posture, further shrinking
  the marginal benefit.

## Follow-up scope (if revisited)

- iOS: upstream (or patch-package) an SPKI server-trust option on
  `react-native-webview` — host allowlist → SPKI hash set — reusing
  `PINNED_ROOT_SPKI_HASHES`, gated by a remote-config kill switch like
  `enable_ssl_pinning_pera_api`.
- Add the Discover host to `tools/check-pinned-chains.mjs` so the pre-release
  chain check covers it; document rotation alongside `pins.ts`.
- Manual MITM verification on both platforms (proxy + custom trusted CA):
  Discover must fail to load with pinning active.
- Android: track WebView/Chromium capability changes; until then rely on the
  bridge-side controls above.
