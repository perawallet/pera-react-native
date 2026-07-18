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

// Maps a mounted iframe URL (PWWebView.web) to the origin set the bridge
// host should trust its chrome.runtime port connections from. Two known
// surfaces today:
//   - Discover: single origin, config.discoverBaseUrl.
//   - Bidali (M8 gift cards): packages/config's per-network bidaliBaseUrl
//     (`https://commerce.bidali.com/dapp` mainnet,
//     `https://commerce.staging.bidali.com/dapp` testnet) 302-redirects to a
//     `giftcards.`-prefixed twin host, query params preserved — verified live
//     2026-07-18. The port the bridge host sees connects from that twin, not
//     the configured commerce origin, so both must be trusted.
// Anything else (unknown URL) gets an empty set — PWWebView.web treats that
// as "do not create a bridge host at all" rather than a host nothing can
// ever authenticate against.
import {
    config,
    getNetworkConfig,
    Networks,
} from '@perawallet/wallet-core-config'

const COMMERCE_HOST_PREFIX = 'commerce.'
const GIFTCARDS_HOST_PREFIX = 'giftcards.'

const safeOrigin = (url: string): string | null => {
    try {
        return new URL(url).origin
    } catch {
        return null
    }
}

// Swaps the `commerce.` host prefix for `giftcards.` per the verified 302.
// Returns null when the configured base isn't commerce-hosted (e.g. an env
// override already pointing at the giftcards host directly) so the caller
// falls back to trusting only the configured origin itself.
const redirectTwinOrigin = (base: string): string | null => {
    let parsed: URL
    try {
        parsed = new URL(base)
    } catch {
        return null
    }
    if (!parsed.hostname.startsWith(COMMERCE_HOST_PREFIX)) return null
    parsed.hostname =
        GIFTCARDS_HOST_PREFIX +
        parsed.hostname.slice(COMMERCE_HOST_PREFIX.length)
    return parsed.origin
}

// Single source of truth for "what are the known mountable surfaces" —
// getTrustedIframeSourceBases and getTrustedIframeOrigins both derive from
// this instead of each re-enumerating Discover + Bidali independently, so
// the two can't drift out of lockstep as future surfaces are added here.
const knownSurfaceBases = (): string[] => [
    config.discoverBaseUrl,
    getNetworkConfig(Networks.mainnet).bidaliBaseUrl,
    getNetworkConfig(Networks.testnet).bidaliBaseUrl,
]

/**
 * The full set of configured source bases — pre-redirect-twin-derivation.
 * Used by PWWebView.web for the `isSecure` check against the *mounted* URL,
 * which is always one of these configured bases and never the post-redirect
 * giftcards twin.
 */
export const getTrustedIframeSourceBases = (): string[] => knownSurfaceBases()

export const getTrustedIframeOrigins = (url: string): string[] => {
    const targetOrigin = safeOrigin(url)
    if (!targetOrigin) return []

    for (const base of knownSurfaceBases()) {
        const baseOrigin = safeOrigin(base)
        if (baseOrigin && targetOrigin === baseOrigin) {
            const twin = redirectTwinOrigin(base)
            return twin ? [baseOrigin, twin] : [baseOrigin]
        }
    }

    return []
}
