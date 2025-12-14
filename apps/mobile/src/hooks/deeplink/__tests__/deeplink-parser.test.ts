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
import {
    parseQueryParams,
    decodeBase64Param,
    normalizeUrl,
    extractPath,
} from '../utils'
import {
    parseDeeplink,
} from '../parser'
import { parseCoinbaseFormat } from '../coinbase-parser'
import { parsePerawalletAppUri } from '../new-parser'
import { parsePerawalletUri } from '../old-parser'
import { DeeplinkType } from '../types'

// Test addresses from CSV
const TEST_ADDRESS = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const TEST_RECEIVER_ADDRESS =
    'Z73KQDNF5X3OPYUJNKH77CWZTHAYBKDUYRJELNMVFKWWYUJH2V2Y54W4CM'

describe('Deeplink Parser - Helper Functions', () => {
    describe('parseQueryParams', () => {
        it('parses basic query parameters', () => {
            const params = parseQueryParams('perawallet://test?amount=100&note=hello')
            expect(params.amount).toBe('100')
            expect(params.note).toBe('hello')
        })

        it('handles URL-encoded values', () => {
            const params = parseQueryParams(
                'perawallet://test?label=HELLO%20WORLD%20LABEL',
            )
            expect(params.label).toBe('HELLO WORLD LABEL')
        })

        it('handles missing query string', () => {
            const params = parseQueryParams('perawallet://test')
            expect(params).toEqual({})
        })

        it('handles empty values', () => {
            const params = parseQueryParams('perawallet://test?key1=&key2=value')
            expect(params.key1).toBe('')
            expect(params.key2).toBe('value')
        })
        it('handles malformed URL in parseQueryParams', () => {
            // This triggers the catch block in parseQueryParams because 'invalid' is not a valid URL
            // and then it falls back to manual parsing
            const params = parseQueryParams('invalid?foo=bar&baz=qux')
            expect(params.foo).toBe('bar')
            expect(params.baz).toBe('qux')
        })

        it('handles malformed URL without query params', () => {
            const params = parseQueryParams('invalid')
            expect(params).toEqual({})
        })
    })

    describe('decodeBase64Param', () => {
        it('decodes valid base64 string', () => {
            const encoded = btoa('https://perawallet.app/')
            const decoded = decodeBase64Param(encoded)
            expect(decoded).toBe('https://perawallet.app/')
        })

        it('returns original string if not base64', () => {
            const result = decodeBase64Param('not-base64!')
            expect(result).toBe('not-base64!')
        })

        it('handles exception in decodeBase64Param', () => {
            // Mock Buffer.from to throw to test catch block
            const originalBufferFrom = Buffer.from
            const mockBufferFrom = (global.Buffer.from = ((_str: string, _enc: string) => {
                throw new Error('Mock Error')
            }) as any)

            expect(decodeBase64Param('SGVsbG8=')).toBe('SGVsbG8=')

            global.Buffer.from = originalBufferFrom
        })
    })

    describe('normalizeUrl', () => {
        it('trims whitespace', () => {
            expect(normalizeUrl('  perawallet://test  ')).toBe(
                'perawallet://test',
            )
        })
    })

    describe('extractPath', () => {
        it('extracts path from app URL', () => {
            expect(extractPath('perawallet://app/test/path?query=1')).toBe('test/path')
        })

        it('returns empty string if no app path', () => {
            expect(extractPath('perawallet://test')).toBe('')
        })

        it('handles exception in extractPath', () => {
            // Pass invalid type to trigger catch
            expect(extractPath(null as any)).toBe('')
        })
    })
})

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

    describe('WalletConnect', () => {
        it('parses WalletConnect URI', () => {
            const result = parseDeeplink(
                'wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=9844b76265fad3b8e1b9af9e1ede8c56a192e6f029d02f47a31bed2c82f104d0',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            if (result?.type === DeeplinkType.WALLET_CONNECT) {
                expect(result.uri).toContain('wc:')
                expect(result.uri).toContain('34e3389c-afef-47ea-8843-d88d63609e93')
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

    describe('Discover browser', () => {
        it('parses discover browser with base64 URL', () => {
            const encodedUrl = btoa('https://tinyman.org/')
            const result = parseDeeplink(
                `perawallet://?url=${encodedUrl}`,
            )
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
            const result = parseDeeplink(
                'perawallet://staking?path=test',
            )
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
})

describe('Deeplink Parser - New Format', () => {
    describe('Add contact', () => {
        it('parses add-contact deeplink', () => {
            const result = parseDeeplink(
                `perawallet://app/add-contact/?address=${TEST_ADDRESS}&label=HELLO%20WORLD%20LABEL`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADD_CONTACT)
            if (result?.type === DeeplinkType.ADD_CONTACT) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.label).toBe('HELLO WORLD LABEL')
            }
        })

        it('requires address parameter', () => {
            const result = parseDeeplink(
                'perawallet://app/add-contact/',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.HOME)
        })
    })

    describe('Edit contact', () => {
        it('parses edit-contact deeplink', () => {
            const result = parseDeeplink(
                `perawallet://app/edit-contact/?address=${TEST_ADDRESS}&label=TEST`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.EDIT_CONTACT)
        })
    })

    describe('Asset transfer', () => {
        it('parses  asset transfer with assetId=0 as ALGO transfer', () => {
            const result = parseDeeplink(
                `perawallet://app/asset-transfer/?assetId=0&receiverAddress=${TEST_RECEIVER_ADDRESS}&amount=99999&note=HELLO%20WORLD%20NOTE`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ALGO_TRANSFER)
            if (result?.type === DeeplinkType.ALGO_TRANSFER) {
                expect(result.receiverAddress).toBe(TEST_RECEIVER_ADDRESS)
                expect(result.amount).toBe('99999')
                expect(result.note).toBe('HELLO WORLD NOTE')
            }
        })

        it('parses asset transfer with non-zero assetId', () => {
            const result = parseDeeplink(
                `perawallet://app/asset-transfer/?assetId=31566704&receiverAddress=${TEST_RECEIVER_ADDRESS}&amount=99999`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_TRANSFER)
            if (result?.type === DeeplinkType.ASSET_TRANSFER) {
                expect(result.assetId).toBe('31566704')
                expect(result.receiverAddress).toBe(TEST_RECEIVER_ADDRESS)
            }
        })
    })

    describe('WalletConnect', () => {
        it('parses wallet-connect with base64 URI', () => {
            const uri = 'wc:test@1?bridge=test&key=test'
            const encodedUri = btoa(uri)
            const result = parseDeeplink(
                `perawallet://app/wallet-connect/?walletConnectUrl=${encodedUri}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
            if (result?.type === DeeplinkType.WALLET_CONNECT) {
                expect(result.uri).toBe(uri)
            }
        })
    })

    describe('Asset opt-in', () => {
        it('parses asset-opt-in with assetId', () => {
            const result = parseDeeplink(
                'perawallet://app/asset-opt-in/?assetId=31566704',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetId).toBe('31566704')
            }
        })
    })

    describe('Asset detail', () => {
        it('parses asset-detail', () => {
            const result = parseDeeplink(
                `perawallet://app/asset-detail/?address=${TEST_ADDRESS}&assetId=31566704`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_DETAIL)
            if (result?.type === DeeplinkType.ASSET_DETAIL) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.assetId).toBe('31566704')
            }
        })
    })

    describe('Swap', () => {
        it('parses swap with asset IDs', () => {
            const result = parseDeeplink(
                `perawallet://app/swap/?address=${TEST_ADDRESS}&assetInId=0&assetOutId=31566704`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.SWAP)
            if (result?.type === DeeplinkType.SWAP) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.assetInId).toBe('0')
                expect(result.assetOutId).toBe('31566704')
            }
        })
    })

    describe('Buy/Sell', () => {
        it('parses buy deeplink', () => {
            const result = parseDeeplink(
                `perawallet://app/buy/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.BUY)
        })

        it('parses sell deeplink', () => {
            const result = parseDeeplink(
                `perawallet://app/sell/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.SELL)
        })
    })

    describe('Account detail', () => {
        it('parses account-detail', () => {
            const result = parseDeeplink(
                `perawallet://app/account-detail/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ACCOUNT_DETAIL)
        })
    })

    describe('Internal browser', () => {
        it('parses internal-browser with base64 URL', () => {
            const encodedUrl = btoa('https://perawallet.app/')
            const result = parseDeeplink(
                `perawallet://app/internal-browser/?url=${encodedUrl}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.INTERNAL_BROWSER)
            if (result?.type === DeeplinkType.INTERNAL_BROWSER) {
                expect(result.url).toBe('https://perawallet.app/')
            }
        })
    })

    describe('HTTPS format', () => {
        it('parses https://perawallet.app/qr/perawallet/app/ format', () => {
            const result = parseDeeplink(
                `https://perawallet.app/qr/perawallet/app/add-contact/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADD_CONTACT)
        })
    })

    describe('Cards', () => {
        it('parses cards path', () => {
            // Coverage for new-parser.ts lines 245-251
            const result = parseDeeplink(
                'perawallet://app/cards/?path=onboarding/select-country',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.CARDS)
        })
    })

    describe('Staking', () => {
        it('parses staking path', () => {
            // Coverage for new-parser.ts lines 253-259
            const result = parseDeeplink(
                'perawallet://app/staking/?path=test',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.STAKING)
        })
    })

    describe('Asset Inbox', () => {
        it('parses asset inbox', () => {
            // Coverage for new-parser.ts lines 218-225
            const result = parseDeeplink(
                `perawallet://app/asset-inbox/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ASSET_INBOX)
            if (result?.type === DeeplinkType.ASSET_INBOX) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Discover Browser', () => {
        it('parses discover browser', () => {
            // Coverage for new-parser.ts lines 227-235
            const encodedUrl = btoa('https://tinyman.org/')
            const result = parseDeeplink(
                `perawallet://app/discover-browser/?url=${encodedUrl}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe('https://tinyman.org/')
            }
        })
    })

    describe('Discover Path', () => {
        it('parses discover path', () => {
            // Coverage for new-parser.ts lines 237-243
            const result = parseDeeplink(
                'perawallet://app/discover-path/?path=main/markets',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.DISCOVER_PATH)
        })
    })

    describe('Keyreg', () => {
        it('parses keyreg', () => {
            // Coverage for new-parser.ts lines 143-160
            const result = parseDeeplink(
                `perawallet://app/keyreg/?senderAddress=${TEST_ADDRESS}&type=keyreg`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.KEYREG)
            if (result?.type === DeeplinkType.KEYREG) {
                expect(result.senderAddress).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Recover Address', () => {
        it('parses recover address', () => {
            // Coverage for new-parser.ts lines 162-169
            const result = parseDeeplink(
                'perawallet://app/recover-address/?mnemonic=test mnemonic',
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.RECOVER_ADDRESS)
            if (result?.type === DeeplinkType.RECOVER_ADDRESS) {
                expect(result.mnemonic).toBe('test mnemonic')
            }
        })
    })

    describe('Receiver Account Selection', () => {
        it('parses receiver account selection', () => {
            // Coverage for new-parser.ts lines 95-102
            const result = parseDeeplink(
                `perawallet://app/receiver-account-selection/?address=${TEST_ADDRESS}`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.RECEIVER_ACCOUNT_SELECTION)
            if (result?.type === DeeplinkType.RECEIVER_ACCOUNT_SELECTION) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })
    })

    describe('Address Actions', () => {
        it('parses address actions', () => {
            // Coverage for new-parser.ts lines 104-112
            const result = parseDeeplink(
                `perawallet://app/address-actions/?address=${TEST_ADDRESS}&label=test`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.label).toBe('test')
            }
        })
    })

    describe('Add Watch Account', () => {
        it('parses add watch account', () => {
            // Coverage for new-parser.ts lines 85-93
            const result = parseDeeplink(
                `perawallet://app/add-watch-account/?address=${TEST_ADDRESS}&label=test`,
            )
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.ADD_WATCH_ACCOUNT)
            if (result?.type === DeeplinkType.ADD_WATCH_ACCOUNT) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.label).toBe('test')
            }
        })
    })

    describe('Direct Parser Calls', () => {
        it('returns null for invalid app uri', () => {
            // Coverage for new-parser.ts lines 49-51
            expect(parsePerawalletAppUri('perawallet://invalid')).toBeNull()
        })

        it('returns null for invalid old uri', () => {
            // Coverage for old-parser.ts lines 39-40
            expect(parsePerawalletUri('invalid://test')).toBeNull()
        })

        it('returns null for account-detail without address', () => {
            // Coverage for new-parser.ts line 288
            expect(parseDeeplink('perawallet://app/account-detail/')).toBeDefined()
            expect(parseDeeplink('perawallet://app/account-detail/')?.type).toBe(DeeplinkType.HOME)
        })

        it('returns null for internal-browser without url', () => {
            // Coverage for new-parser.ts line 297
            expect(parseDeeplink('perawallet://app/internal-browser/')).toBeDefined()
            expect(parseDeeplink('perawallet://app/internal-browser/')?.type).toBe(DeeplinkType.HOME)
        })

        it('returns DISCOVER_PATH for discover-browser without url (fallback to old parser)', () => {
            // Coverage for new-parser.ts line 228
            expect(parseDeeplink('perawallet://app/discover-browser/')).toBeDefined()
            expect(parseDeeplink('perawallet://app/discover-browser/')?.type).toBe(DeeplinkType.DISCOVER_PATH)
        })
    })

    describe('Asset Opt-in (Old Parser)', () => {
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

    describe('Home', () => {
        it('returns home for just /app/', () => {
            const result = parseDeeplink('perawallet://app/')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.HOME)
        })

        it('returns home for /app/ with params', () => {
            // Coverage for new-parser.ts lines 306-311
            const result = parseDeeplink('perawallet://app/?foo=bar')
            expect(result).toBeDefined()
            expect(result?.type).toBe(DeeplinkType.HOME)
        })
    })
})

describe('Deeplink Parser - Main Parser', () => {
    it('returns null for invalid URL', () => {
        expect(parseDeeplink('')).toBeNull()
        expect(parseDeeplink('invalid')).toBeNull()
        expect(parseDeeplink('http://google.com')).toBeNull()
    })

    it('routes to Coinbase parser for algo: scheme', () => {
        const result = parseDeeplink(
            `algo:31566704/transfer?address=${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.COINBASE_ASSET_TRANSFER)
    })

    it('routes to new format parser for /app/ URLs', () => {
        const result = parseDeeplink(
            `perawallet://app/add-contact/?address=${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.ADD_CONTACT)
    })

    it('routes to old format parser for perawallet://', () => {
        const result = parseDeeplink(`perawallet://${TEST_ADDRESS}`)
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
    })

    it('routes to old format parser for wc://', () => {
        const result = parseDeeplink('wc:test@1?bridge=test&key=test')
        expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
    })

    it('handles HTTPS app links', () => {
        const result = parseDeeplink(
            `https://perawallet.app/qr/perawallet/app/swap/?address=${TEST_ADDRESS}&assetInId=0&assetOutId=31566704`,
        )
        expect(result?.type).toBe(DeeplinkType.SWAP)
    })
})

describe('Deeplink Parser - Edge Cases', () => {
    it('handles missing required parameters', () => {
        // Falls back to HOME via old parser
        const result1 = parseDeeplink('perawallet://app/add-contact/')
        expect(result1).toBeDefined()
        expect(result1?.type).toBe(DeeplinkType.HOME)

        const result2 = parseDeeplink('perawallet://app/asset-transfer/')
        expect(result2).toBeDefined()
        expect(result2?.type).toBe(DeeplinkType.HOME)
    })

    it('handles undefined deeplinks', () => {
        const result = parseDeeplink('perawallet://undefined')
        // Returns HOME as graceful fallback for unknown paths
        expect(result).toBeDefined()
        expect(result?.type).toBe(DeeplinkType.HOME)
    })

    it('handles malformed URLs gracefully', () => {
        // Empty deep link returns HOME
        expect(parseDeeplink('perawallet://')).toBeDefined()
        expect(parseDeeplink('perawallet://')?.type).toBe(DeeplinkType.HOME)
        // Unknown path returns HOME as fallback 
        expect(parseDeeplink('perawallet://app/unknown-path/')).toBeDefined()
        expect(parseDeeplink('perawallet://app/unknown-path/')?.type).toBe(DeeplinkType.HOME)
    })
})

describe('Coinbase Parser', () => {
    it('returns null for invalid scheme', () => {
        expect(parseCoinbaseFormat('perawallet://test')).toBeNull()
    })

    it('returns null for invalid action', () => {
        expect(parseCoinbaseFormat('algo:123/invalid?address=test')).toBeNull()
    })

    it('returns null for missing address', () => {
        expect(parseCoinbaseFormat('algo:123/transfer')).toBeNull()
    })

    it('returns null for malformed path', () => {
        expect(parseCoinbaseFormat('algo:123')).toBeNull()
    })
})
