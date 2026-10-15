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

import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    DeeplinkType,
    deeplinkAdapters,
} from '@perawallet/wallet-core-deeplinks'
import { algorandAddressCodec } from '@packages/chain-algorand/src/accounts/address-codec'
import { registerDeeplinkAdapters } from '@test-utils/deeplink-adapters'
import { parseDeeplink } from '../parser'

const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

beforeEach(() => {
    addressCodecs.register(algorandAddressCodec)
    registerDeeplinkAdapters()
})

afterEach(() => {
    addressCodecs.reset()
    deeplinkAdapters.reset()
})

describe('algo: links through the Algorand adapter', () => {
    it('returns null for invalid action', () => {
        expect(parseDeeplink('algo:123/invalid?address=test')).toBeNull()
    })

    it('returns null for missing address', () => {
        expect(parseDeeplink('algo:123/transfer')).toBeNull()
    })

    it('returns null for non-address without path', () => {
        expect(parseDeeplink('algo:123')).toBeNull()
    })

    it('parses valid address as ADDRESS_ACTIONS', () => {
        const result = parseDeeplink(`algo:${TEST_ADDRESS}`)
        expect(result).toMatchObject({
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: `algo:${TEST_ADDRESS}`,
            address: TEST_ADDRESS,
            target: { chainId: 'algorand' },
        })
    })

    it('parses an asset transfer as TRANSFER with the asset and receiverAddress', () => {
        const url = `algo:31566704/transfer?address=${TEST_ADDRESS}`
        const result = parseDeeplink(url)
        expect(result).toMatchObject({
            type: DeeplinkType.TRANSFER,
            sourceUrl: url,
            assetRef: { chainId: 'algorand', assetId: '31566704' },
            receiverAddress: TEST_ADDRESS,
        })
    })

    it('rejects a transfer whose receiver is not a valid address', () => {
        expect(
            parseDeeplink(
                `algo:31566704/transfer?address=${TEST_ADDRESS.slice(0, 57)}`,
            ),
        ).toBeNull()
    })
})
