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
import { PERAWALLET_WC_SCHEME, WC_SCHEME } from './constants'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse WalletConnect URIs: wc:// or perawallet-wc://
 * These are NOT parsed, just wrapped and normalized for the WalletConnect library to handle
 */
export const parseWalletConnectUri = (
    url: string,
): Nullable<WalletConnectDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (
        !normalizedUrl.startsWith(`${WC_SCHEME}:`) &&
        !normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`)
    ) {
        return null
    }

    let wcUri = normalizedUrl
    // Wrapper format: wc://wc?uri=wc%3A... or perawallet-wc://wc?uri=wc%3A...
    // The actual WC URI is URL-encoded in the 'uri' query param
    const uriMatch = normalizedUrl.match(/[?&]uri=([^&]+)/)
    if (uriMatch) {
        try {
            wcUri = decodeURIComponent(uriMatch[1])
        } catch {
            return null
        }
    } else if (normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`)) {
        // Legacy format: perawallet-wc:topic@1?...  →  wc:topic@1?...
        wcUri = normalizedUrl.replace(
            `${PERAWALLET_WC_SCHEME}:`,
            `${WC_SCHEME}:`,
        )
    }

    // Re-validate after unwrap/rewrite so a wrapper like
    // perawallet-wc://wc?uri=javascript%3Aalert(1) cannot smuggle through
    // a non-wc scheme.
    if (!wcUri.startsWith(`${WC_SCHEME}:`)) {
        return null
    }

    return {
        type: DeeplinkType.WALLET_CONNECT,
        sourceUrl: url,
        uri: wcUri,
    }
}
