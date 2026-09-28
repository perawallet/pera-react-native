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

const LOOPBACK_SOURCES = [
    'http://localhost:*',
    'http://127.0.0.1:*',
    'ws://localhost:*',
    'ws://127.0.0.1:*',
]

/**
 * The `extension_pages` policy. In MV3 a declared policy replaces Chrome's
 * default outright, so every directive left unstated would be unrestricted.
 *
 * connect-src stays scheme-wide on purpose: custom node URLs, the WalletConnect
 * v1 bridge (taken from the pairing URI) and NFT copy/save (fetch() on the
 * metadata's media host) all reach hosts no build can enumerate.
 */
export const buildExtensionPagesCsp = ({ appEnvironment, frameOrigins }) => {
    const frameSources = [...new Set(frameOrigins)]
    // LocalNet custom nodes and the e2e fake WalletConnect bridge.
    const loopback = appEnvironment === 'production' ? [] : LOOPBACK_SOURCES

    const directives = [
        ['default-src', "'self'"],
        ['script-src', "'self'", "'wasm-unsafe-eval'"],
        ['object-src', "'none'"],
        ['worker-src', "'self'"],
        ['base-uri', "'self'"],
        // data:/blob: reach no network; NFT copy/save fetch() media URLs that
        // can be either.
        [
            'connect-src',
            "'self'",
            'https:',
            'wss:',
            'data:',
            'blob:',
            ...loopback,
        ],
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

const parseDirectives = csp =>
    new Map(
        csp.split(';').map(entry => {
            const [name, ...sources] = entry.trim().split(/\s+/)
            return [name, sources]
        }),
    )

/**
 * Throws when the generated policy has lost a guarantee. A too-loose policy
 * fails open silently, and a missing frame origin only shows up as a blank
 * Discover or Bidali screen, so both are caught at build time.
 */
export const assertExtensionPagesCsp = (
    csp,
    { appEnvironment, requiredFrameOrigins },
) => {
    const directives = parseDirectives(csp)
    const failures = []
    const expectExactly = (name, expected) => {
        const actual = directives.get(name)?.join(' ')
        if (actual !== expected) {
            failures.push(
                `${name} is "${actual ?? '<missing>'}", expected "${expected}"`,
            )
        }
    }
    expectExactly('default-src', "'self'")
    expectExactly('script-src', "'self' 'wasm-unsafe-eval'")
    expectExactly('object-src', "'none'")

    const frameSources = directives.get('frame-src') ?? []
    for (const origin of requiredFrameOrigins) {
        if (!frameSources.includes(origin)) {
            failures.push(`frame-src is missing ${origin}`)
        }
    }
    for (const source of frameSources) {
        if (!source.startsWith('https://')) {
            failures.push(`frame-src allows a non-https source: ${source}`)
        }
    }
    if (
        appEnvironment === 'production' &&
        LOOPBACK_SOURCES.some(source => csp.includes(source))
    ) {
        failures.push('a production policy allows loopback')
    }
    if (failures.length > 0) {
        throw new Error(
            'generated extension CSP is unsafe or incomplete:\n  - ' +
                failures.join('\n  - '),
        )
    }
}
