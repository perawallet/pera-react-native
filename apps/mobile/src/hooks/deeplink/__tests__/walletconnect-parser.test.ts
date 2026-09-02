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
