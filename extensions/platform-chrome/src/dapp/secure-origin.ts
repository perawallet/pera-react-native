/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Shared secure-context gate for every page-facing trust boundary (the
// ARC-0027 dapp router and the WebAuthn ceremony router).
//
// Why the scheme matters and a bare host check is not enough: credential
// lookup and RP-ID resolution key on the *bare* registrable domain with no
// scheme, so a credential minted at `https://example.com` is reachable from
// `http://example.com`, and an ARC-0027 grant issued to one is a grant the
// other can present. Without this check an attacker who can forge a plaintext
// response — on-path on the victim's network (hostile Wi-Fi, ISP, captive
// portal) — drives a full ceremony against the victim's HTTPS credential, and
// the approval window truthfully names the domain the user trusts. Browsers
// make this structurally impossible by refusing WebAuthn outside a secure
// context; this is our equivalent, and it must be enforced here on the
// browser-stamped `sender.origin` rather than only in the manifest, because
// the manifest governs *injection* and this governs *authorization*.
//
// The loopback carve-out mirrors the browser's own secure-context rule so
// local dapp development against http://localhost keeps working.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * True when `origin` is a secure context we are willing to authorize: any
 * `https:` origin, plus `http:` on loopback. Opaque origins (the literal
 * string `'null'`, from sandboxed/`data:` frames) are always rejected.
 */
export const isSecureDappOrigin = (
    origin: string | null | undefined,
): origin is string => {
    if (!origin || origin === 'null') return false

    let parsed: URL
    try {
        parsed = new URL(origin)
    } catch {
        return false
    }

    if (parsed.protocol === 'https:') return true
    if (parsed.protocol !== 'http:') return false
    // `URL.hostname` keeps IPv6 literals bracketed, so `[::1]` matches as-is.
    return LOOPBACK_HOSTS.has(parsed.hostname)
}
