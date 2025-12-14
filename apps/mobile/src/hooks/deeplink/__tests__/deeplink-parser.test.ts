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

import { DeeplinkType } from '../types'

// Test addresses from CSV
const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

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

    it('routes to wallet connect format parser for wc://', () => {
        const result = parseDeeplink('wc:test@1?bridge=test&key=test')
        expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
    })

    it('handles HTTPS app links', () => {
        const result = parseDeeplink(
            `https://perawallet.app/qr/perawallet/app/swap/?address=${TEST_ADDRESS}&assetInId=0&assetOutId=31566704`,
        )
        expect(result?.type).toBe(DeeplinkType.SWAP)
    })

    it('handles HTTPS old format links', () => {
        const result = parseDeeplink(
            `https://perawallet.app/qr/perawallet/${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
    })

    it('returns null for unknown HTTPS links', () => {
        expect(parseDeeplink('https://perawallet.app/unknown')).toBeNull()
    })

    it('routes to wallet connect parser for perawallet-wc://', () => {
        const result = parseDeeplink(
            'perawallet-wc:test@1?bridge=test&key=test',
        )
        expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
    })

    it('routes to algorand parser for algorand://', () => {
        const result = parseDeeplink(`algorand://${TEST_ADDRESS}`)
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
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
        expect(parseDeeplink('perawallet://app/unknown-path/')?.type).toBe(
            DeeplinkType.HOME,
        )
    })
})
