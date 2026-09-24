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

const COMMERCE_HOST_PREFIX = 'commerce.'
const GIFTCARDS_HOST_PREFIX = 'giftcards.'

const LOOPBACK_SOURCES = [
    'http://localhost:*',
    'http://127.0.0.1:*',
    'ws://localhost:*',
    'ws://127.0.0.1:*',
]

const toOrigin = url => {
    try {
        return new URL(url).origin
    } catch {
        return null
    }
}

// Bidali's commerce host 302s to a `giftcards.` twin, and frame-src is checked
// again after the redirect. Mirrors trusted-iframe-origins.web.ts in the app.
const withRedirectTwin = url => {
    const origin = toOrigin(url)
    if (!origin) return []
    const parsed = new URL(origin)
    if (!parsed.hostname.startsWith(COMMERCE_HOST_PREFIX)) return [origin]
    parsed.hostname =
        GIFTCARDS_HOST_PREFIX +
        parsed.hostname.slice(COMMERCE_HOST_PREFIX.length)
    return [origin, parsed.origin]
}

/**
 * The `extension_pages` policy. In MV3 a declared policy replaces Chrome's
 * default outright, so every directive left unstated would be unrestricted.
 *
 * connect-src stays scheme-wide on purpose: custom node URLs, the WalletConnect
 * v1 bridge (taken from the pairing URI) and NFT copy/save (fetch() on the
 * metadata's media host) all reach hosts no build can enumerate.
 */
export const buildExtensionPagesCsp = ({
    appEnvironment,
    discoverBaseUrl,
    integrityCheckOrigin,
    bidaliBaseUrls,
    termsOfServiceUrl,
}) => {
    const frameSources = [
        ...new Set(
            [
                toOrigin(discoverBaseUrl),
                toOrigin(integrityCheckOrigin),
                toOrigin(termsOfServiceUrl),
                ...bidaliBaseUrls.flatMap(withRedirectTwin),
            ].filter(Boolean),
        ),
    ]
    // LocalNet custom nodes and the e2e fake WalletConnect bridge.
    const loopback = appEnvironment === 'production' ? [] : LOOPBACK_SOURCES

    const directives = [
        ['default-src', "'self'"],
        ['script-src', "'self'", "'wasm-unsafe-eval'"],
        ['object-src', "'none'"],
        ['worker-src', "'self'"],
        ['base-uri', "'self'"],
        ['connect-src', "'self'", 'https:', 'wss:', ...loopback],
        ['img-src', "'self'", 'https:', 'data:', 'blob:'],
        ['media-src', "'self'", 'https:', 'blob:'],
        ['frame-src', ...(frameSources.length ? frameSources : ["'none'"])],
        // build.mjs injects inline <style> blocks and react-native-web adds
        // style elements at runtime.
        ['style-src', "'self'", "'unsafe-inline'"],
        ['font-src', "'self'"],
    ]
    return directives.map(parts => parts.join(' ')).join('; ')
}
