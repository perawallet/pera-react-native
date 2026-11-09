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

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFetchAndPersistNames = vi.hoisted(() => vi.fn())
const mockGetNamesByAddresses = vi.hoisted(() => vi.fn())

vi.mock('../../sync/name-syncer', () => ({
    fetchAndPersistNames: mockFetchAndPersistNames,
}))

vi.mock('../../db', () => ({
    getNamesByAddresses: mockGetNamesByAddresses,
}))

import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { nameBatchQueue } from '../nameBatchQueue'

const ALGORAND_MAINNET_KEY = toScopeKey({
    chainId: 'algorand',
    networkId: 'mainnet',
})
const ETHEREUM_SEPOLIA_KEY = toScopeKey({
    chainId: 'ethereum',
    networkId: 'sepolia',
})

const ADDR_A = 'A'.repeat(58)
const ADDR_B = 'B'.repeat(58)
const ADDR_C = 'C'.repeat(58)

const ALICE = { name: 'alice.algo', image: '', source: 'nfd' }
const BOB = { name: 'bob.algo', image: '', source: 'nfd' }

describe('nameBatchQueue (adapter)', () => {
    beforeEach(() => {
        mockFetchAndPersistNames.mockReset().mockResolvedValue(undefined)
        mockGetNamesByAddresses.mockReset().mockResolvedValue([])
    })

    it('coalesces concurrent enqueues into one fetchAndPersistNames call per scope', async () => {
        mockGetNamesByAddresses.mockResolvedValue([
            { address: ADDR_A, name: ALICE, updatedAt: Date.now() },
            { address: ADDR_B, name: BOB, updatedAt: Date.now() },
            { address: ADDR_C, name: null, updatedAt: Date.now() },
        ])

        const [a, b, c] = await Promise.all([
            nameBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
            nameBatchQueue.enqueue(ADDR_B, ALGORAND_MAINNET_KEY),
            nameBatchQueue.enqueue(ADDR_C, ALGORAND_MAINNET_KEY),
        ])

        expect(mockFetchAndPersistNames).toHaveBeenCalledTimes(1)
        const [addresses, scope] = mockFetchAndPersistNames.mock.calls[0]
        expect(new Set(addresses)).toEqual(new Set([ADDR_A, ADDR_B, ADDR_C]))
        expect(scope).toEqual({ chainId: 'algorand', networkId: 'mainnet' })

        // Each waiter resolves with its own per-key value from the re-read
        expect(a).toEqual(ALICE)
        expect(b).toEqual(BOB)
        expect(c).toBeNull()
    })

    it('separates batches per scope', async () => {
        mockGetNamesByAddresses.mockResolvedValue([])

        await Promise.all([
            nameBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
            nameBatchQueue.enqueue(ADDR_B, ETHEREUM_SEPOLIA_KEY),
        ])

        expect(mockFetchAndPersistNames).toHaveBeenCalledTimes(2)
        const scopes = mockFetchAndPersistNames.mock.calls.map(c => c[1])
        expect(scopes).toContainEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(scopes).toContainEqual({
            chainId: 'ethereum',
            networkId: 'sepolia',
        })
    })

    it('coalesces lookups whose scope keys were built from distinct scope objects', async () => {
        await Promise.all([
            nameBatchQueue.enqueue(
                ADDR_A,
                toScopeKey({ chainId: 'ethereum', networkId: 'sepolia' }),
            ),
            nameBatchQueue.enqueue(
                ADDR_B,
                toScopeKey({ chainId: 'ethereum', networkId: 'sepolia' }),
            ),
        ])

        expect(mockFetchAndPersistNames).toHaveBeenCalledTimes(1)
    })

    it('rejects waiters when fetchAndPersistNames throws', async () => {
        mockFetchAndPersistNames.mockRejectedValue(new Error('boom'))
        await expect(
            nameBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
        ).rejects.toThrow('boom')
    })

    it('resolves with undefined when getNamesByAddresses returns no row for the key', async () => {
        // Executor completes (e.g. address was filtered out by checksum) but
        // produces no row in the cache for ADDR_A → waiter sees undefined.
        mockGetNamesByAddresses.mockResolvedValue([])

        const result = await nameBatchQueue.enqueue(
            ADDR_A,
            ALGORAND_MAINNET_KEY,
        )
        expect(result).toBeUndefined()
    })
})
