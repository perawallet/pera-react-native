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

import { describe, it, expect } from 'vitest'
import { parseDeeplink } from '../parser'
import { parseWalletConnectUri } from '../walletconnect-parser'
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
    })
})
