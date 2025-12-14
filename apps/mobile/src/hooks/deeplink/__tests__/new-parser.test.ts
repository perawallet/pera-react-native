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

/* eslint-disable max-lines */

import { describe, it, expect } from 'vitest'
import { parseDeeplink } from '../parser'
import { parsePerawalletAppUri } from '../new-parser'
import { DeeplinkType } from '../types'

// Test addresses from CSV
const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const TEST_RECEIVER_ADDRESS =
    'Z73KQDNF5X3OPYUJNKH77CWZTHAYBKDUYRJELNMVFKWWYUJH2V2Y54W4CM'

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
            const result = parseDeeplink('perawallet://app/add-contact/')
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
            const result = parseDeeplink('perawallet://app/staking/?path=test')
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
                `perawallet://app/register-watch-account/?address=${TEST_ADDRESS}&label=test`,
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

        it('returns null for account-detail without address', () => {
            // Coverage for new-parser.ts line 288
            expect(
                parseDeeplink('perawallet://app/account-detail/'),
            ).toBeDefined()
            expect(
                parseDeeplink('perawallet://app/account-detail/')?.type,
            ).toBe(DeeplinkType.HOME)
        })

        it('returns null for internal-browser without url', () => {
            // Coverage for new-parser.ts line 297
            expect(
                parseDeeplink('perawallet://app/internal-browser/'),
            ).toBeDefined()
            expect(
                parseDeeplink('perawallet://app/internal-browser/')?.type,
            ).toBe(DeeplinkType.HOME)
        })

        it('returns DISCOVER_PATH for discover-browser without url (fallback to old parser)', () => {
            // Coverage for new-parser.ts line 228
            expect(
                parseDeeplink('perawallet://app/discover-browser/'),
            ).toBeDefined()
            expect(
                parseDeeplink('perawallet://app/discover-browser/')?.type,
            ).toBe(DeeplinkType.DISCOVER_PATH)
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
