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

const mockFetchAndPersistNfds = vi.hoisted(() => vi.fn())
const mockGetNfdsByAddresses = vi.hoisted(() => vi.fn())

vi.mock('../../sync/nfd-syncer', () => ({
    fetchAndPersistNfds: mockFetchAndPersistNfds,
}))

vi.mock('../../db', () => ({
    getNfdsByAddresses: mockGetNfdsByAddresses,
}))

import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { nfdBatchQueue } from '../nfdBatchQueue'

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

describe('nfdBatchQueue (adapter)', () => {
    beforeEach(() => {
        mockFetchAndPersistNfds.mockReset().mockResolvedValue(undefined)
        mockGetNfdsByAddresses.mockReset().mockResolvedValue([])
    })

    it('coalesces concurrent enqueues into one fetchAndPersistNfds call per scope', async () => {
        mockGetNfdsByAddresses.mockResolvedValue([
            { address: ADDR_A, name: ALICE, updatedAt: Date.now() },
            { address: ADDR_B, name: BOB, updatedAt: Date.now() },
            { address: ADDR_C, name: null, updatedAt: Date.now() },
        ])

        const [a, b, c] = await Promise.all([
            nfdBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
            nfdBatchQueue.enqueue(ADDR_B, ALGORAND_MAINNET_KEY),
            nfdBatchQueue.enqueue(ADDR_C, ALGORAND_MAINNET_KEY),
        ])

        expect(mockFetchAndPersistNfds).toHaveBeenCalledTimes(1)
        const [addresses, scope] = mockFetchAndPersistNfds.mock.calls[0]
        expect(new Set(addresses)).toEqual(new Set([ADDR_A, ADDR_B, ADDR_C]))
        expect(scope).toEqual({ chainId: 'algorand', networkId: 'mainnet' })

        // Each waiter resolves with its own per-key value from the re-read
        expect(a).toEqual(ALICE)
        expect(b).toEqual(BOB)
        expect(c).toBeNull()
    })

    it('separates batches per scope', async () => {
        mockGetNfdsByAddresses.mockResolvedValue([])

        await Promise.all([
            nfdBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
            nfdBatchQueue.enqueue(ADDR_B, ETHEREUM_SEPOLIA_KEY),
        ])

        expect(mockFetchAndPersistNfds).toHaveBeenCalledTimes(2)
        const scopes = mockFetchAndPersistNfds.mock.calls.map(c => c[1])
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
            nfdBatchQueue.enqueue(
                ADDR_A,
                toScopeKey({ chainId: 'ethereum', networkId: 'sepolia' }),
            ),
            nfdBatchQueue.enqueue(
                ADDR_B,
                toScopeKey({ chainId: 'ethereum', networkId: 'sepolia' }),
            ),
        ])

        expect(mockFetchAndPersistNfds).toHaveBeenCalledTimes(1)
    })

    it('rejects waiters when fetchAndPersistNfds throws', async () => {
        mockFetchAndPersistNfds.mockRejectedValue(new Error('boom'))
        await expect(
            nfdBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY),
        ).rejects.toThrow('boom')
    })

    it('resolves with undefined when getNfdsByAddresses returns no row for the key', async () => {
        // Executor completes (e.g. address was filtered out by checksum) but
        // produces no row in the cache for ADDR_A → waiter sees undefined.
        mockGetNfdsByAddresses.mockResolvedValue([])

        const result = await nfdBatchQueue.enqueue(ADDR_A, ALGORAND_MAINNET_KEY)
        expect(result).toBeUndefined()
    })
})
