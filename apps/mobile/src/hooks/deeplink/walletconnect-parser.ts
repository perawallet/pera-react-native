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

import { DeeplinkType, type WalletConnectDeeplink } from './types'
import { normalizeUrl } from './utils'
import {
    ALGORAND_WC_SCHEME,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from './constants'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse WalletConnect URIs: wc://, perawallet-wc://, or algorand-wc://
 * These are NOT parsed, just wrapped and normalized for the WalletConnect library to handle
 */
export const parseWalletConnectUri = (
    url: string,
): Nullable<WalletConnectDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (
        !normalizedUrl.startsWith(`${WC_SCHEME}:`) &&
        !normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`) &&
        !normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`)
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
    } else if (normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`)) {
        // Native-parity format: algorand-wc:topic@1?...  →  wc:topic@1?...
        wcUri = normalizedUrl.replace(`${ALGORAND_WC_SCHEME}:`, `${WC_SCHEME}:`)
    }

    // Re-validate after unwrap/rewrite so a wrapper like
    // perawallet-wc://wc?uri=javascript%3Aalert(1) cannot smuggle through
    // a non-wc scheme.
    if (!wcUri.startsWith(`${WC_SCHEME}:`)) {
        return null
    }

    // A real WC v1 pairing URI always carries a bridge (`wc:<topic>@1?bridge=…`).
    // dApps also emit non-pairing `wc://?…` signals (e.g. a return-to-wallet
    // focus hint with `?browser=…`) that have no bridge. Routing one into the
    // WC client throws "Invalid or missing bridge url parameter value", so
    // reject anything without a non-empty bridge param here.
    if (!/[?&]bridge=[^&]+/.test(wcUri)) {
        return null
    }

    return {
        type: DeeplinkType.WALLET_CONNECT,
        sourceUrl: url,
        uri: wcUri,
    }
}

/**
 * Log-safe identifiers for a WC v1 pairing URI. Never returns the URI
 * itself: its `key=` param is the symmetric pairing secret, and error-level
 * log context is shipped to the crash reporter. Topic and bridge origin are
 * safe; both are visible in plaintext to the public bridge server.
 */
export const walletConnectLogContext = (
    uri: string,
): { topic: Nullable<string>; bridgeOrigin: Nullable<string> } => {
    const topic = /^wc:([^@?#]+)@/.exec(uri)?.[1] ?? null
    const bridgeValue = /[?&]bridge=([^&#]+)/.exec(uri)?.[1]
    let bridgeOrigin: Nullable<string> = null
    if (bridgeValue) {
        try {
            const origin = new URL(decodeURIComponent(bridgeValue)).origin
            bridgeOrigin = origin === 'null' ? null : origin
        } catch {
            // A malformed bridge value only costs this diagnostic field.
        }
    }
    return { topic, bridgeOrigin }
}
