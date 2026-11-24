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

import { afterEach, describe, expect, it } from 'vitest'
import { addressCodecs, truncateAddressOn } from '../contracts/address-codec'
import { FIXTURE_CHAIN_ID, fixtureCodec } from './fixture-chain'

describe('truncateAddressOn', () => {
    afterEach(() => {
        addressCodecs.reset()
    })

    it("uses the chain codec's short form", () => {
        addressCodecs.register(fixtureCodec)
        const address = 'ab'.repeat(20)

        expect(truncateAddressOn(FIXTURE_CHAIN_ID, address)).toBe(
            fixtureCodec.truncate(address),
        )
    })

    it('keeps the address as given on a chain with no codec', () => {
        expect(truncateAddressOn(FIXTURE_CHAIN_ID, '0xabc')).toBe('0xabc')
    })
})
