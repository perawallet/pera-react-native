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
import { transformBulkResults, transformSearchResults } from '../mappers'
import type { NameSearchApiResponse } from '../schema'
import { registerFakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ALGORAND_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

const validAddress =
    'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'

const searchResponse = (
    entries: Array<{ name: string; address: string; chain?: string }>,
): NameSearchApiResponse => ({
    count: entries.length,
    results: entries.map(entry => ({
        name: entry.name,
        address: entry.address,
        chain: entry.chain ?? ALGORAND_CAIP2,
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
            ALGORAND_MAINNET,
            ALGORAND_CAIP2,
        )

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            name: 'alice.algo',
            address: validAddress,
            service: { name: 'nfd', logo: 'logo.png' },
        })
    })

    it('drops a result for another chain even when its address is well-formed', () => {
        const result = transformSearchResults(
            searchResponse([
                {
                    name: 'alice.algo',
                    address: validAddress,
                    chain: 'eip155:1',
                },
            ]),
            ALGORAND_MAINNET,
            ALGORAND_CAIP2,
        )

        expect(result).toEqual([])
    })

    it('passes a valid backend result through unchanged', () => {
        const result = transformSearchResults(
            searchResponse([{ name: 'bob.algo', address: validAddress }]),
            ALGORAND_MAINNET,
            ALGORAND_CAIP2,
        )

        expect(result).toHaveLength(1)
        expect(result[0].address).toBe(validAddress)
    })
})

describe('transformBulkResults', () => {
    it('reads a missing image as an empty string', () => {
        const result = transformBulkResults({
            results: [
                {
                    address: 'ADDR',
                    name: { name: 'alice.eth', source: 'ens', image: null },
                },
            ],
        })

        expect(result[0].name?.image).toBe('')
    })
})
