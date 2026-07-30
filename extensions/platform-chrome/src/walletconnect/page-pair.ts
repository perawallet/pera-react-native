/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Page-originated WalletConnect pair request: a web page's content script asks
// the wallet to pair with a `wc:` URI it scraped from a @perawallet/connect
// modal.
//
// This is deliberately a SEPARATE scope from WC_CONTROL_SCOPE. The control
// channel is gated to extension-origin senders (see onWcControlMessage's
// isTrustedExtensionPageSender check) precisely so a content script cannot
// drive it; this scope is the one message a page IS allowed to send, and the
// service worker validates it before translating it into a control message.
//
// It carries NO origin field on purpose. The requesting origin is stamped by
// the service worker from the browser-provided `sender.origin`, which a page
// cannot forge. Any origin-shaped field on this message is ignored.
export const WC_PAGE_PAIR_SCOPE = 'pera-wc-page-pair' as const

// Mirrors the cap in apps/extension/src/content/connect-modal-uri.ts. Real WC
// URIs are far under this; longer inputs are malformed or hostile.
const WC_URI_MAX_LENGTH = 4096

export type WcPagePairMessage = {
    scope: typeof WC_PAGE_PAIR_SCOPE
    uri: string
}

export const isWcPagePairMessage = (
    value: unknown,
): value is WcPagePairMessage => {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    if (candidate.scope !== WC_PAGE_PAIR_SCOPE) return false
    const { uri } = candidate
    if (typeof uri !== 'string') return false
    if (uri.length === 0 || uri.length > WC_URI_MAX_LENGTH) return false
    return uri.startsWith('wc:') || uri.startsWith('perawallet-wc:')
}
