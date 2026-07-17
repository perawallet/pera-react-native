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

import { parseCoinbaseFormat } from '../coinbase-parser'
import { DeeplinkType } from '../types'

const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

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

    it('returns null for non-address without path', () => {
        expect(parseCoinbaseFormat('algo:123')).toBeNull()
    })

    it('parses valid address as ADDRESS_ACTIONS', () => {
        const result = parseCoinbaseFormat(`algo:${TEST_ADDRESS}`)
        expect(result).toEqual({
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: `algo:${TEST_ADDRESS}`,
            address: TEST_ADDRESS,
        })
    })

    it('parses asset transfer with ASSET_TRANSFER type and receiverAddress', () => {
        const url = `algo:31566704/transfer?address=${TEST_ADDRESS}`
        const result = parseCoinbaseFormat(url)
        expect(result).toEqual({
            type: DeeplinkType.ASSET_TRANSFER,
            sourceUrl: url,
            assetId: '31566704',
            receiverAddress: TEST_ADDRESS,
        })
    })
})
