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

// @vitest-environment node

import { parseDeeplink } from '../parser'
import {
    isWalletConnectFocusHint,
    isWalletConnectScheme,
    parseWalletConnectUri,
    walletConnectLogContext,
} from '../walletconnect-parser'
import { DeeplinkType } from '../types'

describe('WalletConnect Parser', () => {
    describe('Integration via parseDeeplink', () => {
        it('parses WalletConnect URI', () => {
            const result = parseDeeplink(
                'wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=9844b76265fad3b8e1b9af9e1ede8c56a192e6f029d02f47a31bed2c82f104d0',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            if (result?.type === DeeplinkType.WALLET_CONNECT) {
                expect(result.uri).toContain('wc:')
                expect(result.uri).toContain(
                    '34e3389c-afef-47ea-8843-d88d63609e93',
                )
            }
        })

        it('normalizes perawallet-wc:// to wc://', () => {
            const result = parseDeeplink(
                'perawallet-wc:test@1?bridge=test&key=test',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            if (result?.type === DeeplinkType.WALLET_CONNECT) {
                expect(result.uri).toContain('wc:')
            }
        })

        it('routes algorand-wc: through to WALLET_CONNECT', () => {
            const result = parseDeeplink(
                'algorand-wc:test@1?bridge=test&key=test',
            )
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            if (result?.type === DeeplinkType.WALLET_CONNECT) {
                expect(result.uri).toContain('wc:')
            }
        })
    })

    describe('Direct parseWalletConnectUri calls', () => {
        it('returns null for invalid scheme', () => {
            expect(parseWalletConnectUri('invalid:test')).toBeNull()
        })

        it('parses valid wc: URI', () => {
            const uri = 'wc:test@1?bridge=test&key=test'
            const result = parseWalletConnectUri(uri)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            expect(result?.uri).toBe(uri)
        })

        it('parses and normalizes perawallet-wc: URI', () => {
            const uri = 'perawallet-wc:test@1?bridge=test&key=test'
            const result = parseWalletConnectUri(uri)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            expect(result?.uri).toBe('wc:test@1?bridge=test&key=test')
        })

        it('rejects wrapper that unwraps to a non-wc scheme', () => {
            // perawallet-wc://wc?uri=javascript%3Aalert(1) decodes to 'javascript:alert(1)'
            expect(
                parseWalletConnectUri(
                    'perawallet-wc://wc?uri=javascript%3Aalert(1)',
                ),
            ).toBeNull()
            expect(
                parseWalletConnectUri('wc://wc?uri=https%3A%2F%2Fevil.example'),
            ).toBeNull()
        })

        it('rejects wrapper with malformed percent-encoding', () => {
            expect(
                parseWalletConnectUri('perawallet-wc://wc?uri=%E0%A4%A'),
            ).toBeNull()
        })

        it('unwraps a valid encoded wc: URI in the wrapper', () => {
            const inner = 'wc:test@1?bridge=test&key=test'
            const wrapped =
                'perawallet-wc://wc?uri=' + encodeURIComponent(inner)
            const result = parseWalletConnectUri(wrapped)
            expect(result?.uri).toBe(inner)
        })

        it('rejects a wc: URI with no bridge (e.g. a return-to-wallet signal, not a pairing URI)', () => {
            // dApps emit signals like `wc://?browser=...` to bring the wallet
            // to the foreground. These are not pairing URIs — they carry no
            // bridge — and routing them into the WC client throws
            // "Invalid or missing bridge url parameter value".
            expect(
                parseWalletConnectUri('wc://?browser=Android%20Browser'),
            ).toBeNull()
        })

        it('rejects a wc: URI with a topic but no bridge param', () => {
            expect(parseWalletConnectUri('wc:test@1?key=test')).toBeNull()
        })

        it('rejects a wc: URI with an empty bridge param', () => {
            expect(
                parseWalletConnectUri('wc:test@1?bridge=&key=test'),
            ).toBeNull()
        })

        it('parses and normalizes algorand-wc: URI', () => {
            const result = parseWalletConnectUri(
                'algorand-wc:test@1?bridge=test&key=test',
            )
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            expect(result?.uri).toBe('wc:test@1?bridge=test&key=test')
        })

        it('unwraps a valid encoded wc: URI in an algorand-wc wrapper', () => {
            const inner = 'wc:test@1?bridge=test&key=test'
            const wrapped = 'algorand-wc://wc?uri=' + encodeURIComponent(inner)
            expect(parseWalletConnectUri(wrapped)?.uri).toBe(inner)
        })

        it('rejects an algorand-wc: URI with no bridge', () => {
            expect(
                parseWalletConnectUri('algorand-wc:test@1?key=test'),
            ).toBeNull()
        })
    })

    describe('classification helpers', () => {
        it('isWalletConnectScheme recognizes every WC scheme and nothing else', () => {
            expect(isWalletConnectScheme('wc:t@1?bridge=x&key=y')).toBe(true)
            expect(isWalletConnectScheme('perawallet-wc://wc?uri=x')).toBe(true)
            expect(isWalletConnectScheme('algorand-wc:t@1?key=y')).toBe(true)
            expect(isWalletConnectScheme('perawallet://app/home')).toBe(false)
            expect(isWalletConnectScheme('https://perawallet.app')).toBe(false)
        })

        it('isWalletConnectFocusHint matches only bridge-less topic-less focus signals', () => {
            expect(
                isWalletConnectFocusHint('wc://?browser=Android%20Browser'),
            ).toBe(true)
            expect(
                isWalletConnectFocusHint('perawallet-wc://?browser=chrome'),
            ).toBe(true)
            // WC v2 pairing URIs and bridge-less v1 URIs carry a
            // topic@version segment — they are failed pairings, not hints.
            expect(
                isWalletConnectFocusHint(
                    'wc:abc@2?relay-protocol=irn&symKey=ff',
                ),
            ).toBe(false)
            expect(isWalletConnectFocusHint('wc:t@1?key=y')).toBe(false)
            // A mangled wrapper still names a uri= — a failed pairing too.
            expect(
                isWalletConnectFocusHint('perawallet-wc://wc?uri=%E0%A4%A'),
            ).toBe(false)
            expect(isWalletConnectFocusHint('perawallet://app/home')).toBe(
                false,
            )
        })
    })

    describe('partially-encoded wrapper URIs', () => {
        it('keeps the key param of an unencoded inner URI instead of truncating at the first &', () => {
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=wc:t@1?bridge=https://bridge.example&key=abc',
            )
            expect(result?.uri).toBe(
                'wc:t@1?bridge=https://bridge.example&key=abc',
            )
        })

        it('strips known wrapper params appended after an unencoded inner URI', () => {
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=wc:t@1?bridge=https://bridge.example&key=abc&browser=Safari&singleAccount=true&selectedAccount=X',
            )
            expect(result?.uri).toBe(
                'wc:t@1?bridge=https://bridge.example&key=abc',
            )
            expect(result?.browserName).toBe('Safari')
        })

        it('keeps a fully-encoded inner URI byte-identical when wrapper params follow', () => {
            const inner = 'wc:t@1?bridge=https://bridge.example&key=abc'
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=' +
                    encodeURIComponent(inner) +
                    '&browser=chrome',
            )
            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBe('chrome')
        })
    })

    describe('browserName extraction (iOS @perawallet/connect wrapper)', () => {
        const inner = 'wc:test@1?bridge=test&key=test'

        it('extracts the browser param from the wrapper', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=chrome'
            const result = parseWalletConnectUri(wrapped)
            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBe('chrome')
        })

        it('decodes a percent-encoded browser value', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=Mobile%20Safari'
            expect(parseWalletConnectUri(wrapped)?.browserName).toBe(
                'Mobile Safari',
            )
        })

        it('leaves browserName undefined when the wrapper has no browser param', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' + encodeURIComponent(inner)
            expect(parseWalletConnectUri(wrapped)?.browserName).toBeUndefined()
        })

        it('ignores a browser param inside a raw (non-wrapper) WC URI', () => {
            const result = parseWalletConnectUri(
                'wc:test@1?bridge=test&key=test&browser=chrome',
            )
            expect(result).not.toBeNull()
            expect(result?.browserName).toBeUndefined()
        })

        it('still parses when the browser param has malformed percent-encoding', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=%E0%A4%A'
            const result = parseWalletConnectUri(wrapped)
            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBeUndefined()
        })
    })

    describe('walletConnectLogContext', () => {
        it('extracts topic and bridge origin without exposing the key', () => {
            const out = walletConnectLogContext(
                'wc:abc-topic@1?bridge=https%3A%2F%2Fbridge.example%2Fsub&key=deadbeef',
            )
            expect(out).toEqual({
                topic: 'abc-topic',
                bridgeOrigin: 'https://bridge.example',
            })
            expect(JSON.stringify(out)).not.toContain('deadbeef')
        })

        it('handles an unencoded bridge value', () => {
            expect(
                walletConnectLogContext(
                    'wc:t@1?bridge=https://b.example&key=beef',
                ),
            ).toEqual({ topic: 't', bridgeOrigin: 'https://b.example' })
        })

        it('returns nulls for a non-wc string', () => {
            expect(walletConnectLogContext('https://evil.com')).toEqual({
                topic: null,
                bridgeOrigin: null,
            })
        })

        it('returns a null bridgeOrigin for a malformed bridge value', () => {
            expect(
                walletConnectLogContext('wc:t@1?bridge=%ZZ&key=beef'),
            ).toEqual({ topic: 't', bridgeOrigin: null })
        })
    })
})
