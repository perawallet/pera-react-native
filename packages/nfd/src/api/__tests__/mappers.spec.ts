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

import { beforeEach, describe, expect, it } from 'vitest'
import { transformSearchResults } from '../mappers'
import type { NfdSearchApiResponse } from '../schema'
import { registerFakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'

const validAddress =
    'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'

const searchResponse = (
    entries: Array<{ name: string; address: string }>,
): NfdSearchApiResponse => ({
    count: entries.length,
    results: entries.map(entry => ({
        name: entry.name,
        address: entry.address,
        service: { name: 'nfd', logo: 'logo.png' },
    })),
})

describe('transformSearchResults', () => {
    beforeEach(() => {
        registerFakeNameServiceAdapter({
            isValidAddress: address => address === validAddress,
        })
    })

    it("drops results whose backend-asserted address the chain's adapter rejects", () => {
        const result = transformSearchResults(
            searchResponse([
                { name: 'alice.algo', address: validAddress },
                { name: 'attacker.algo', address: 'not-a-real-address' },
                { name: 'garbage.algo', address: '' },
            ]),
            'mainnet',
        )

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            name: 'alice.algo',
            address: validAddress,
            service: { name: 'nfd', logo: 'logo.png' },
        })
    })

    it('passes a valid backend result through unchanged', () => {
        const result = transformSearchResults(
            searchResponse([{ name: 'bob.algo', address: validAddress }]),
            'mainnet',
        )

        expect(result).toHaveLength(1)
        expect(result[0].address).toBe(validAddress)
    })
})
