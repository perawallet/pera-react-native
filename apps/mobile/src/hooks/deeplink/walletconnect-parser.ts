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
    ALGORAND_SCHEME,
    ALGORAND_WC_SCHEME,
    PERAWALLET_WC_SCHEME,
    WC_SCHEME,
} from './constants'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The pairing wrapper emitted by @perawallet/connect < Feb 2025, whose
 * Android deep-link base was `algorand://`. Deliberately narrow — a plain
 * `algorand://…` link is an ARC-90 URI, not WalletConnect.
 */
const isLegacyAlgorandWcWrapper = (normalizedUrl: string): boolean =>
    normalizedUrl.startsWith(`${ALGORAND_SCHEME}://wc?`)

export const isWalletConnectScheme = (url: string): boolean => {
    const normalizedUrl = normalizeUrl(url)
    return (
        normalizedUrl.startsWith(`${WC_SCHEME}:`) ||
        normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`) ||
        normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`) ||
        isLegacyAlgorandWcWrapper(normalizedUrl)
    )
}

/**
 * The dApp SDK's "return-to-wallet" focus signal (`wc://?browser=…`): a
 * wc-schemed URL with no `<topic>@<version>` segment and no wrapped `uri=`
 * param. It exists only to foreground the wallet — the actual request rides
 * the already-open socket — so it must never surface an error. Anything
 * wc-schemed that fails to parse but ISN'T a focus hint is a failed pairing
 * the user should hear about.
 */
export const isWalletConnectFocusHint = (url: string): boolean => {
    if (!isWalletConnectScheme(url)) return false
    const normalizedUrl = normalizeUrl(url)
    if (/[?&]uri=/.test(normalizedUrl)) return false
    const beforeQuery = normalizedUrl
        .replace(/^[a-z0-9-]+:(\/\/)?/, '')
        .split('?')[0]
    return !/@\d/.test(beforeQuery)
}

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
        !normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`) &&
        !isLegacyAlgorandWcWrapper(normalizedUrl)
    ) {
        return null
    }

    let wcUri = normalizedUrl
    let browserName: string | undefined
    // Wrapper format: wc://wc?uri=wc%3A... or perawallet-wc://wc?uri=wc%3A...
    // The actual WC URI is URL-encoded in the 'uri' query param. Captured to
    // end-of-string, NOT to the next '&': hand-rolled dApp redirects often
    // skip the encoding, and a [^&]+ capture would silently drop the inner
    // URI's own `key=` param — a guaranteed pairing timeout. The wrapper's
    // own params (`@perawallet/connect` appends browser / singleAccount /
    // selectedAccount after the uri) are bounded off explicitly instead.
    const uriMatch = normalizedUrl.match(/[?&]uri=(.+)$/)
    if (uriMatch) {
        const bounded = uriMatch[1].replace(
            /&(?:browser|singleAccount|selectedAccount)=.*$/,
            '',
        )
        try {
            wcUri = decodeURIComponent(bounded)
        } catch {
            return null
        }
    } else if (isLegacyAlgorandWcWrapper(normalizedUrl)) {
        // Wrapper base without a uri param is not a pairing link (the
        // legacy Android redirect signal was `algorand://?browser=…`);
        // never forward a bare `algorand://wc?…` to the WC client.
        return null
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

    // The initiating browser rides a trailing `browser=` param so the
    // connection success sheet can deep-link back to it. It appears on the
    // wrapper on iOS, but @perawallet/connect's Android branch appends it
    // to the RAW wc: URI (`deepLink = uri` + `&browser=…`) — extract it
    // from either shape. WC v1 defines no `browser` param, so a trailing
    // one is unambiguously connect's metadata.
    const browserMatch = normalizedUrl.match(/[?&]browser=([^&]+)/)
    if (browserMatch) {
        try {
            browserName = decodeURIComponent(browserMatch[1])
        } catch {
            // Malformed encoding only costs the return CTA,
            // never the pairing itself.
        }
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
        browserName,
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
