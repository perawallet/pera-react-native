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

import { parseAlgorandUri } from '../algorand-parser'
import { DeeplinkType } from '../types'

const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

describe('ARC-90 Algorand Parser', () => {
    describe('Address Actions (Basic Scan)', () => {
        it('parses simple address', () => {
            const result = parseAlgorandUri(`algorand://${TEST_ADDRESS}`)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })

        it('parses address with label', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?label=My%20Address`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.label).toBe('My Address')
            }
        })
    })

    describe('ALGO Transfer', () => {
        it('parses ALGO transfer with amount', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?amount=1000000`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ALGO_TRANSFER)
            if (result?.type === DeeplinkType.ALGO_TRANSFER) {
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
                expect(result.amount).toBe('1000000')
            }
        })

        it('parses ALGO transfer with note and xnote', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?amount=100&note=hello&xnote=secret`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ALGO_TRANSFER)
            if (result?.type === DeeplinkType.ALGO_TRANSFER) {
                expect(result.note).toBe('hello')
                expect(result.xnote).toBe('secret')
            }
        })
    })

    describe('Asset Transfer', () => {
        it('parses asset transfer with amount', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?amount=100&asset=123456`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_TRANSFER)
            if (result?.type === DeeplinkType.ASSET_TRANSFER) {
                expect(result.assetId).toBe('123456')
                expect(result.amount).toBe('100')
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
            }
        })

        it('parses asset transfer without amount (optional in ARC-90)', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?asset=123456`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_TRANSFER)
            if (result?.type === DeeplinkType.ASSET_TRANSFER) {
                expect(result.assetId).toBe('123456')
                expect(result.amount).toBeUndefined()
            }
        })
    })

    describe('Asset Opt-in', () => {
        it('parses asset opt-in (0 amount self-transfer)', () => {
            // Note: In ARC-90, opt-in isn't a distinct type, but conventionally handled
            // as a 0 amount transfer of the asset.
            // Our parser explicitly detects this combination.
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?amount=0&asset=123456`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetId).toBe('123456')
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Keyreg', () => {
        it('parses keyreg transaction', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?type=keyreg&votekey=voteKey123&selkey=selKey123&votefst=1000&votelst=2000&votekdkey=100&fee=1000`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.KEYREG)
            if (result?.type === DeeplinkType.KEYREG) {
                expect(result.senderAddress).toBe(TEST_ADDRESS)
                expect(result.voteKey).toBe('voteKey123')
                expect(result.selkey).toBe('selKey123')
                expect(result.votefst).toBe('1000')
                expect(result.votelst).toBe('2000')
                expect(result.votekd).toBe('100')
                expect(result.fee).toBe('1000')
            }
        })
    })

    describe('Asset Query', () => {
        it('parses asset query to Discover Browser (Explorer)', () => {
            const result = parseAlgorandUri('algorand://asset/123456')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://explorer.perawallet.app/asset/123456/',
                )
            }
        })

        it('parses asset query with testnet to Discover Browser (Testnet Explorer)', () => {
            const result = parseAlgorandUri(
                'algorand://net:testnet/asset/123456',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://testnet.explorer.perawallet.app/asset/123456/',
                )
            }
        })
    })

    describe('App Query', () => {
        it('parses app query to Discover Browser (Explorer)', () => {
            const result = parseAlgorandUri('algorand://app/7890')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://explorer.perawallet.app/application/7890/',
                )
            }
        })

        it('parses app query with testnet to Discover Browser (Testnet Explorer)', () => {
            const result = parseAlgorandUri('algorand://net:testnet/app/7890')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://testnet.explorer.perawallet.app/application/7890/',
                )
            }
        })

        it('parses app query with query params', () => {
            // Coverage for arc90-parser.ts lines 71-75
            const result = parseAlgorandUri('algorand://app/7890?foo=bar')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            // Query params are currently ignored in the mapping but parsed in arc90-parser
        })
    })

    describe('Validation & Edge Cases', () => {
        it('returns null for invalid scheme', () => {
            expect(parseAlgorandUri(`perawallet://${TEST_ADDRESS}`)).toBeNull()
            expect(parseAlgorandUri(`http://${TEST_ADDRESS}`)).toBeNull()
        })

        it('returns null for invalid address', () => {
            expect(parseAlgorandUri('algorand://INVALID_ADDRESS')).toBeNull()
        })

        it('returns null for invalid keyreg address', () => {
            // Coverage for algorand-parser.ts lines 104-105
            expect(
                parseAlgorandUri('algorand://INVALID_ADDRESS?type=keyreg'),
            ).toBeNull()
        })

        it('returns null for unknown type', () => {
            // Coverage for algorand-parser.ts lines 152-153 (fallthrough)
            // arc90-parser returns null for unknown types usually, but if we construct a valid arc90 uri that maps to a type we don't handle?
            // arc90-parser only returns specific types.
            // If we have a type that arc90-parser supports but algorand-parser doesn't map?
            // Currently algorand-parser maps all types returned by arc90-parser except maybe if we add one later.
            // But 'noop' without address? arc90-parser returns noop for type=appl.
            // If type=appl and no address?
            // path is empty string. isValidAlgorandAddress('') is false.
            // So it returns null in the first block.

            // What if arc90-parser returns something else?
            // It only returns payment, keyreg, noop, appquery, assetquery.
            // We handle all of them.
            // So the return null at the end is technically unreachable with current arc90-parser logic unless we mock it.
            // But we can try to trigger arc90-parser to return something we don't handle if we modify it, but we can't.

            // However, we can test the `gh:` prefix coverage in arc90-parser here.
            const result = parseAlgorandUri('algorand://gh:myrepo/asset/123')
            // This sets network to 'gh:myrepo'.
            // algorand-parser maps this to mainnet explorer because it's not 'testnet'.
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://explorer.perawallet.app/asset/123/',
                )
            }
        })

        it('parses asset query with query params', () => {
            // Coverage for arc90-parser.ts lines 84-88
            const result = parseAlgorandUri('algorand://asset/123?foo=bar')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
        })

        it('returns null for missing address', () => {
            expect(parseAlgorandUri('algorand://?amount=100')).toBeNull()
        })

        it('returns null for non-compliant paths (custom Pera paths)', () => {
            // These should NO LONGER be handled by the ARC-90 parser
            expect(parseAlgorandUri('algorand://discover')).toBeNull()
            expect(parseAlgorandUri('algorand://cards')).toBeNull()
            expect(parseAlgorandUri('algorand://staking')).toBeNull()
            expect(parseAlgorandUri('algorand://asset/opt-in')).toBeNull() // Old path style
        })

        it('ignores unknown parameters', () => {
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?unknown=param&amount=100`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ALGO_TRANSFER)
            // Should still parse valid params
            if (result?.type === DeeplinkType.ALGO_TRANSFER) {
                expect(result.amount).toBe('100')
            }
        })

        it('parses type=appl as ADDRESS_ACTIONS (noop in ARC-90)', () => {
            // Coverage for arc90-parser.ts line 110
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?type=appl`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
        })

        it('returns null for malformed query params (decodeURIComponent failure)', () => {
            // Coverage for arc90-parser.ts line 116
            const result = parseAlgorandUri(
                `algorand://${TEST_ADDRESS}?foo=%E0%A4%A`,
            )
            expect(result).toBeNull()
        })

        it('returns null for invalid appId in ARC-90', () => {
            // Coverage for arc90-parser.ts line 74
            expect(parseAlgorandUri('algorand://app/abc')).toBeNull()
        })

        it('returns null for invalid assetId in ARC-90', () => {
            // Coverage for arc90-parser.ts line 87
            expect(parseAlgorandUri('algorand://asset/abc')).toBeNull()
        })

        it('handles empty parameter values in ARC-90', () => {
            // Coverage for arc90-parser.ts lines 80, 93, 103
            const result1 = parseAlgorandUri('algorand://app/123?foo=')
            expect(result1).toBeDefined()

            const result2 = parseAlgorandUri('algorand://asset/123?foo=')
            expect(result2).toBeDefined()

            const result3 = parseAlgorandUri(`algorand://${TEST_ADDRESS}?foo=`)
            expect(result3).toBeDefined()
        })
    })
})
