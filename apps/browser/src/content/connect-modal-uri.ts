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

// Shared extraction of the WalletConnect pairing URI from a
// @perawallet/connect connect-modal. Used by the Discover-iframe bridge
// (discover-main.ts) and by the all-URLs connect-modal watcher. Ported from
// native's peraConnectJS (apps/mobile/src/modules/webview/components/PWWebView/
// injected-scripts.ts) — the fallback chain below tolerates connect DOM drift
// across 1.x versions, so keep all three branches.
export const CONNECT_MODAL_WRAPPER_ID = 'pera-wallet-connect-modal-wrapper'

const WC_SCHEME = 'wc'
const PERAWALLET_WC_SCHEME = 'perawallet-wc'

// Cap forwarded URI length (real WC URIs are well under this; longer inputs
// are either malformed or a hostile page trying to overload the RPC bridge).
const WC_URI_MAX_LENGTH = 4096

export const isWcUri = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= WC_URI_MAX_LENGTH &&
    (value.startsWith(`${WC_SCHEME}:`) ||
        value.startsWith(`${PERAWALLET_WC_SCHEME}:`))

export const extractUriFromConnectModal = (
    wrapper: Element | null,
): string | null => {
    if (!wrapper) return null
    // Current (@perawallet/connect >=1.3): the wc URI is set as the 'uri'
    // attribute on the <pera-wallet-connect-modal> custom element itself
    // (with '&algorand=true' appended).
    const modal = wrapper.querySelector('pera-wallet-connect-modal')
    if (modal) {
        const attr = modal.getAttribute('uri')
        if (isWcUri(attr)) return attr
        // Legacy: a launch button nested inside touch-screen-mode shadow DOM.
        try {
            const touch = modal.shadowRoot?.querySelector(
                'pera-wallet-modal-touch-screen-mode',
            )
            const btn = touch?.shadowRoot?.querySelector(
                '#pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button',
            )
            const href = btn?.getAttribute('href')
            if (isWcUri(href)) return href
        } catch {
            // DOM probing across shadow roots — tolerate absence/shape drift.
        }
    }
    // Legacy: class-based fallback (pre-shadow-DOM versions).
    const legacy = wrapper.getElementsByClassName(
        'pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button',
    )[0]
    const legacyHref = legacy?.getAttribute('href')
    if (isWcUri(legacyHref)) return legacyHref
    return null
}
