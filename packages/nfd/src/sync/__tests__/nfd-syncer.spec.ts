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
import { fetchAndPersistNfds } from '../nfd-syncer'
import { NFD_BULK_CHUNK_SIZE } from '../../constants'
import { Networks } from '@perawallet/wallet-core-config'

const mockFetchNfdBulkRead = vi.hoisted(() => vi.fn())
const mockUpsertNfdEntries = vi.hoisted(() => vi.fn())
const mockGetStaleOrMissingAddresses = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchNfdBulkRead: mockFetchNfdBulkRead,
}))

vi.mock('../../db', () => ({
    upsertNfdEntries: mockUpsertNfdEntries,
    getStaleOrMissingAddresses: mockGetStaleOrMissingAddresses,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (address?: string) =>
        !!address && /^[0-9a-zA-Z]{58}$/.test(address),
}))

const makeAddress = (i: number): string =>
    `${i.toString(36).padStart(2, '0')}${'A'.repeat(56)}`.slice(0, 58)

const ADDR_A = 'A'.repeat(58)
const ADDR_B = 'B'.repeat(58)
const ADDR_C = 'C'.repeat(58)

describe('fetchAndPersistNfds', () => {
    beforeEach(() => {
        mockFetchNfdBulkRead.mockReset()
        mockUpsertNfdEntries.mockReset().mockResolvedValue(undefined)
        mockGetStaleOrMissingAddresses
            .mockReset()
            .mockImplementation(async ({ addresses }) => addresses)
    })

    it('is a no-op for empty input', async () => {
        await fetchAndPersistNfds([], 'mainnet')
        expect(mockFetchNfdBulkRead).not.toHaveBeenCalled()
        expect(mockUpsertNfdEntries).not.toHaveBeenCalled()
    })

    it('filters invalid addresses before fetching', async () => {
        await fetchAndPersistNfds(['not-an-address', ''], 'mainnet')
        expect(mockGetStaleOrMissingAddresses).not.toHaveBeenCalled()
        expect(mockFetchNfdBulkRead).not.toHaveBeenCalled()
    })

    it('drops bad-checksum addresses but keeps the rest of the batch', async () => {
        // Mixed batch: one valid, one too short. The bad one must not sink
        // the request — bulk-read returns 400 if any single address is
        // invalid, so we filter strictly before sending.
        mockFetchNfdBulkRead.mockResolvedValue([])
        await fetchAndPersistNfds([ADDR_A, 'short'], 'mainnet')

        expect(mockFetchNfdBulkRead).toHaveBeenCalledTimes(1)
        const sent = mockFetchNfdBulkRead.mock.calls[0][0].addresses
        expect(sent).toEqual([ADDR_A])
    })

    it('deduplicates addresses before fetching', async () => {
        mockFetchNfdBulkRead.mockResolvedValue([])
        await fetchAndPersistNfds([ADDR_A, ADDR_A, ADDR_A], 'mainnet')
        expect(mockGetStaleOrMissingAddresses).toHaveBeenCalledTimes(1)
        const passed = mockGetStaleOrMissingAddresses.mock.calls[0][0].addresses
        expect(passed).toHaveLength(1)
    })

    it('skips fetch when all addresses are cached and fresh', async () => {
        mockGetStaleOrMissingAddresses.mockResolvedValue([])
        await fetchAndPersistNfds([ADDR_A], 'mainnet')
        expect(mockFetchNfdBulkRead).not.toHaveBeenCalled()
        expect(mockUpsertNfdEntries).not.toHaveBeenCalled()
    })

    it('fetches stale/missing addresses and persists positive results', async () => {
        mockFetchNfdBulkRead.mockResolvedValue([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])

        await fetchAndPersistNfds([ADDR_A], 'mainnet')

        expect(mockFetchNfdBulkRead).toHaveBeenCalledTimes(1)
        expect(mockUpsertNfdEntries).toHaveBeenCalledTimes(1)
        const persisted = mockUpsertNfdEntries.mock.calls[0][0].entries
        expect(persisted).toEqual([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])
    })

    it('persists negative results for addresses absent from response', async () => {
        mockFetchNfdBulkRead.mockResolvedValue([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
            // ADDR_B intentionally absent
        ])

        await fetchAndPersistNfds([ADDR_A, ADDR_B], 'mainnet')

        const persisted = mockUpsertNfdEntries.mock.calls[0][0].entries
        const entryB = persisted.find(
            (e: { address: string }) => e.address === ADDR_B,
        )
        expect(entryB).toBeDefined()
        expect(entryB.name).toBeNull()
    })

    it('chunks requests larger than NFD_BULK_CHUNK_SIZE', async () => {
        const unique = Array.from({ length: NFD_BULK_CHUNK_SIZE + 5 }, (_, i) =>
            makeAddress(i),
        )
        expect(new Set(unique).size).toBe(unique.length)
        mockFetchNfdBulkRead.mockResolvedValue([])

        await fetchAndPersistNfds(unique, 'mainnet')

        expect(mockFetchNfdBulkRead).toHaveBeenCalledTimes(2)
        const first = mockFetchNfdBulkRead.mock.calls[0][0].addresses.length
        const second = mockFetchNfdBulkRead.mock.calls[1][0].addresses.length
        expect(first + second).toBe(unique.length)
        expect(first).toBeLessThanOrEqual(NFD_BULK_CHUNK_SIZE)
        expect(second).toBeLessThanOrEqual(NFD_BULK_CHUNK_SIZE)
    })

    it('does not write cache rows when fetch fails', async () => {
        mockFetchNfdBulkRead.mockRejectedValue(new Error('boom'))
        await fetchAndPersistNfds([ADDR_C], 'mainnet')
        expect(mockUpsertNfdEntries).not.toHaveBeenCalled()
    })

    it('isolates failures across batches', async () => {
        const unique = Array.from({ length: NFD_BULK_CHUNK_SIZE + 1 }, (_, i) =>
            makeAddress(i),
        )
        // First batch fails, second batch (1 address) succeeds
        mockFetchNfdBulkRead
            .mockRejectedValueOnce(new Error('first batch boom'))
            .mockResolvedValueOnce([])

        await fetchAndPersistNfds(unique, 'mainnet')

        // The successful batch should still write
        expect(mockUpsertNfdEntries).toHaveBeenCalledTimes(1)
    })
})

describe('non-Pera-backed networks', () => {
    beforeEach(() => {
        mockFetchNfdBulkRead.mockReset()
        mockUpsertNfdEntries.mockReset().mockResolvedValue(undefined)
        mockGetStaleOrMissingAddresses
            .mockReset()
            .mockImplementation(async ({ addresses }) => addresses)
    })

    it.each([Networks.betanet, Networks.custom])(
        'writes nothing on %s',
        async network => {
            await fetchAndPersistNfds([ADDR_A], network)

            expect(mockFetchNfdBulkRead).not.toHaveBeenCalled()
            expect(mockUpsertNfdEntries).not.toHaveBeenCalled()
        },
    )

    it('still persists misses as null on mainnet', async () => {
        mockFetchNfdBulkRead.mockResolvedValue([])

        await fetchAndPersistNfds([ADDR_A], Networks.mainnet)

        expect(mockUpsertNfdEntries).toHaveBeenCalledTimes(1)
        const persisted = mockUpsertNfdEntries.mock.calls[0][0].entries
        expect(persisted).toEqual([{ address: ADDR_A, name: null }])
    })
})
