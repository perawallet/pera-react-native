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

// The one message a page's content script may send: a separate scope from the
// extension-gated control channel, validated by the service worker before it
// becomes a control message. No origin field: the SW stamps `sender.origin`.
export const WC_PAGE_PAIR_SCOPE = 'pera-wc-page-pair' as const

// Real WC URIs are far under this; longer inputs are malformed or hostile.
// Keep in step with apps/browser/src/content/connect-modal-uri.ts.
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
