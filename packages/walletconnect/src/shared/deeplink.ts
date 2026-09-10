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

import type { Nullable } from '@perawallet/wallet-core-shared'

/** Scheme names only; call sites append `://` (hierarchical) or `:` (opaque). */
export const WC_SCHEME = 'wc'
export const PERAWALLET_WC_SCHEME = 'perawallet-wc'
/** Registered by the native iOS app; rewritten to `wc:` so old links keep routing. */
export const ALGORAND_WC_SCHEME = 'algorand-wc'
const ALGORAND_SCHEME = 'algorand'

export type WalletConnectPairingLink = {
    /** The unwrapped `wc:` pairing URI. */
    uri: string
    /** The initiating mobile browser, when `@perawallet/connect` named one. */
    browserName?: string
}

// Only the scheme is lowercased: the rest of a URI may be case-sensitive.
const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/)
    if (schemeMatch) {
        return schemeMatch[1].toLowerCase() + ':' + schemeMatch[2]
    }
    return trimmed.toLowerCase()
}

// The pairing wrapper of @perawallet/connect < Feb 2025, whose Android base
// was `algorand://`. Narrow on purpose: a plain `algorand://…` link is ARC-90.
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
 * The dApp SDK's return-to-wallet focus signal (`wc://?browser=…`): wc-schemed,
 * no `<topic>@<version>`, no wrapped `uri=`. It only foregrounds the wallet, so
 * it must never surface an error; anything else wc-schemed that fails to parse
 * is a failed pairing the user should hear about.
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

// Index scans rather than a regex: `[?&]name=` followed by a greedy tail
// backtracks polynomially, and a deep link is attacker-supplied.
const readParamTail = (url: string, name: string): string | undefined => {
    const needle = `${name}=`
    for (
        let at = url.indexOf(needle);
        at !== -1;
        at = url.indexOf(needle, at + 1)
    ) {
        const before = at === 0 ? '' : url[at - 1]
        if (before !== '?' && before !== '&') continue
        const value = url.slice(at + needle.length)
        if (value.length > 0) return value
    }
    return undefined
}

// `&`-prefixed only: @perawallet/connect appends these after the wrapped uri.
const CONNECT_TRAILERS = ['browser', 'singleAccount', 'selectedAccount']

const dropConnectTrailers = (value: string): string => {
    let cut = value.length
    for (const name of CONNECT_TRAILERS) {
        const at = value.indexOf(`&${name}=`)
        if (at !== -1 && at < cut) cut = at
    }
    return value.slice(0, cut)
}

/**
 * Unwraps `wc:`, `perawallet-wc:`, `algorand-wc:` and the wrapper forms into
 * the bare `wc:` URI the WalletConnect client takes. Nothing inside is parsed.
 */
export const parseWalletConnectUri = (
    url: string,
): Nullable<WalletConnectPairingLink> => {
    const normalizedUrl = normalizeUrl(url)

    if (!isWalletConnectScheme(normalizedUrl)) {
        return null
    }

    let wcUri = normalizedUrl
    let browserName: string | undefined
    // Read to end-of-string, not to the next `&`: hand-rolled dApp redirects
    // often skip encoding the inner URI, and stopping at `&` would drop its `key=`.
    const wrappedUri = readParamTail(normalizedUrl, 'uri')
    if (wrappedUri !== undefined) {
        try {
            wcUri = decodeURIComponent(dropConnectTrailers(wrappedUri))
        } catch {
            return null
        }
    } else if (isLegacyAlgorandWcWrapper(normalizedUrl)) {
        // A bare `algorand://wc?…` was the legacy Android redirect signal, not a pairing.
        return null
    } else if (normalizedUrl.startsWith(`${PERAWALLET_WC_SCHEME}:`)) {
        wcUri = normalizedUrl.replace(
            `${PERAWALLET_WC_SCHEME}:`,
            `${WC_SCHEME}:`,
        )
    } else if (normalizedUrl.startsWith(`${ALGORAND_WC_SCHEME}:`)) {
        wcUri = normalizedUrl.replace(`${ALGORAND_WC_SCHEME}:`, `${WC_SCHEME}:`)
    }

    // Re-validated after unwrapping so `…?uri=javascript%3Aalert(1)` cannot
    // smuggle a non-wc scheme through.
    if (!wcUri.startsWith(`${WC_SCHEME}:`)) {
        return null
    }

    // iOS puts `browser=` on the wrapper; @perawallet/connect's Android branch
    // appends it to the raw wc: URI. WC v1 defines no `browser` param, so a
    // trailing one is unambiguously connect's metadata either way.
    const browserMatch = normalizedUrl.match(/[?&]browser=([^&]+)/)
    if (browserMatch) {
        try {
            browserName = decodeURIComponent(browserMatch[1])
        } catch {
            // Malformed encoding only costs the return-to-dApp CTA.
        }
    }

    // A bridge-less URI is a focus hint, not a pairing; the WC client throws
    // "Invalid or missing bridge url parameter value" on it.
    if (!/[?&]bridge=[^&]+/.test(wcUri)) {
        return null
    }

    return { uri: wcUri, browserName }
}
