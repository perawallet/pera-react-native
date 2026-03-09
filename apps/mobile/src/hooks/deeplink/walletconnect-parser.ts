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

import { DeeplinkType, WalletConnectDeeplink } from './types'
import { normalizeUrl } from './utils'

/**
 * Parse WalletConnect URIs: wc:// or perawallet-wc://
 * These are NOT parsed, just wrapped and normalized for the WalletConnect library to handle
 */
export const parseWalletConnectUri = (
    url: string,
): WalletConnectDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (
        !normalizedUrl.startsWith('wc:') &&
        !normalizedUrl.startsWith('perawallet-wc:')
    ) {
        return null
    }

    let wcUri = normalizedUrl
    // Wrapper format: wc://wc?uri=wc%3A... or perawallet-wc://wc?uri=wc%3A...
    // The actual WC URI is URL-encoded in the 'uri' query param
    const uriMatch = normalizedUrl.match(/[?&]uri=([^&]+)/)
    if (uriMatch) {
        wcUri = decodeURIComponent(uriMatch[1])
    } else if (normalizedUrl.startsWith('perawallet-wc:')) {
        // Legacy format: perawallet-wc:topic@1?...  →  wc:topic@1?...
        wcUri = normalizedUrl.replace('perawallet-wc:', 'wc:')
    }

    return {
        type: DeeplinkType.WALLET_CONNECT,
        sourceUrl: url,
        uri: wcUri,
    }
}
