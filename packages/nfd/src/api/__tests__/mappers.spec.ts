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

import { describe, it, expect, vi } from 'vitest'

// The blockchain barrel pulls native deps (react-native-mmkv) that don't load
// under node, so it can't be imported for real here. Delegate to algosdk
// directly rather than a shape regex: a base32-shaped string with a bad
// checksum is exactly what this filter must reject, and a regex mock would
// wave it through (making the assertion below vacuous).
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const { decodeAddress } = await import('algosdk')
    return {
        isValidAlgorandAddress: (address?: string) => {
            if (!address) return false
            try {
                decodeAddress(address)
                return true
            } catch {
                return false
            }
        },
    }
})

import { transformSearchResults } from '../mappers'
import type { NfdSearchApiResponse } from '../schema'

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
    it('drops results whose backend-asserted address is not a valid Algorand address (PERA-4718)', () => {
        const result = transformSearchResults(
            searchResponse([
                { name: 'alice.algo', address: validAddress },
                { name: 'attacker.algo', address: 'not-a-real-address' },
                { name: 'garbage.algo', address: '' },
                // Right length and alphabet, wrong checksum — the case a
                // shape-only check would let through.
                { name: 'checksum.algo', address: 'A'.repeat(58) },
            ]),
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
        )

        expect(result).toHaveLength(1)
        expect(result[0].address).toBe(validAddress)
    })
})
