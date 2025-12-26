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


import { parseDeeplink } from '../parser'
import { parsePerawalletUri } from '../old-parser'
import { DeeplinkType } from '../types'

// Test addresses from CSV
const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

describe('Deeplink Parser - Old Format', () => {
    describe('Address-only deeplinks', () => {
        it('parses basic address deeplink', () => {
            const result = parseDeeplink(`perawallet://${TEST_ADDRESS}`)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })

        it('parses algorand:// scheme', () => {
            const result = parseDeeplink(`algorand://${TEST_ADDRESS}`)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
        })
    })

    describe('ALGO transfer', () => {
        it('parses ALGO transfer with amount and note', () => {
            const result = parseDeeplink(
                `perawallet://${TEST_ADDRESS}?amount=99999&note=HELLO%20WORLD%20NOTE`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ALGO_TRANSFER)
            if (result?.type === DeeplinkType.ALGO_TRANSFER) {
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
                expect(result.amount).toBe('99999')
                expect(result.note).toBe('HELLO WORLD NOTE')
            }
        })
    })

    describe('Asset transfer', () => {
        it('parses asset transfer with all parameters', () => {
            const result = parseDeeplink(
                `perawallet://${TEST_ADDRESS}?amount=99999&asset=31566704&xnote=HELLO%20WORLD%20XNOTE`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_TRANSFER)
            if (result?.type === DeeplinkType.ASSET_TRANSFER) {
                expect(result.assetId).toBe('31566704')
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
                expect(result.amount).toBe('99999')
                expect(result.xnote).toBe('HELLO WORLD XNOTE')
            }
        })
    })

    describe('Asset opt-in', () => {
        it('parses asset opt-in with amount=0', () => {
            const result = parseDeeplink(
                `perawallet://?amount=0&asset=31566704`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetId).toBe('31566704')
            }
        })

        it('parses notification-style opt-in', () => {
            const result = parseDeeplink(
                `perawallet://asset/opt-in?asset=31566704&account=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
        })

        it('parses type=asset/opt-in param', () => {
            const result = parseDeeplink(
                `perawallet://?type=asset/opt-in&asset=31566704&account=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
        })
    })

    describe('Asset Transactions', () => {
        it('parses asset transactions', () => {
            // Coverage for old-parser.ts lines 92-98
            const result = parseDeeplink(
                `perawallet://?type=asset/transactions&asset=31566704&account=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_TRANSACTIONS)
            if (result?.type === DeeplinkType.ASSET_TRANSACTIONS) {
                expect(result.assetId).toBe('31566704')
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Asset Inbox', () => {
        it('parses asset inbox', () => {
            // Coverage for old-parser.ts lines 101-107
            const result = parseDeeplink(
                `perawallet://?type=asset-inbox&account=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_INBOX)
            if (result?.type === DeeplinkType.ASSET_INBOX) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Keyreg', () => {
        it('parses keyreg transaction', () => {
            const result = parseDeeplink(
                `perawallet://${TEST_ADDRESS}?type=keyreg&selkey=-lfw-Y04lTnllJfncgMjXuAePe8i8YyVeoR9c1Xi78c&votekey=UU8zLMrFVfZPnzbnL6ThAArXFsznV3TvFVAun2ONcEI&votefst=1300&votelst=11300&votekd=100&fee=2000000`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.KEYREG)
            if (result?.type === DeeplinkType.KEYREG) {
                expect(result.senderAddress).toBe(TEST_ADDRESS)
                expect(result.keyregType).toBe('keyreg')
                expect(result.voteKey).toBe(
                    'UU8zLMrFVfZPnzbnL6ThAArXFsznV3TvFVAun2ONcEI',
                )
                expect(result.votefst).toBe('1300')
                expect(result.votelst).toBe('11300')
            }
        })
    })

    describe('Discover browser', () => {
        it('parses discover browser with base64 URL', () => {
            const encodedUrl = btoa('https://tinyman.org/')
            const result = parseDeeplink(`perawallet://?url=${encodedUrl}`)
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe('https://tinyman.org/')
            }
        })
    })

    describe('Discover/Cards/Staking', () => {
        it('parses discover path', () => {
            const result = parseDeeplink(
                'perawallet://discover?path=main/markets',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_PATH)
            if (result?.type === DeeplinkType.DISCOVER_PATH) {
                expect(result.path).toBe('main/markets')
            }
        })

        it('parses cards path', () => {
            const result = parseDeeplink(
                'perawallet://cards?path=onboarding/select-country',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.CARDS)
        })

        it('parses staking path', () => {
            const result = parseDeeplink('perawallet://staking?path=test')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.STAKING)
        })
    })

    describe('Home fallback', () => {
        it('returns home for empty perawallet://', () => {
            const result = parseDeeplink('perawallet://')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.HOME)
        })

        it('returns home for perawallet:// with only params', () => {
            const result = parseDeeplink(
                'perawallet://?param1=hello&param2=world',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.HOME)
        })
    })

    describe('Direct Parser Calls', () => {
        it('returns null for invalid old uri', () => {
            // Coverage for old-parser.ts lines 39-40
            expect(parsePerawalletUri('invalid://test')).toBeNull()
        })

        it('parses asset opt-in with amount=0 and address', () => {
            // Coverage for old-parser.ts lines 152-159
            const result = parseDeeplink(
                `perawallet://${TEST_ADDRESS}?amount=0&asset=31566704`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetId).toBe('31566704')
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })
})
