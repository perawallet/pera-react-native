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
import { fetchAndPersistNames } from '../name-syncer'
import { NAME_BULK_CHUNK_SIZE } from '../../constants'
import { registerFakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

const mockFetchAddressNames = vi.hoisted(() => vi.fn())
const mockUpsertNameEntries = vi.hoisted(() => vi.fn())
const mockGetStaleOrMissingAddresses = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchAddressNames: mockFetchAddressNames,
}))

vi.mock('../../db', () => ({
    upsertNameEntries: mockUpsertNameEntries,
    getStaleOrMissingAddresses: mockGetStaleOrMissingAddresses,
}))

const makeAddress = (i: number): string =>
    `${i.toString(36).padStart(2, '0')}${'A'.repeat(56)}`.slice(0, 58)

const ADDR_A = 'A'.repeat(58)
const ADDR_B = 'B'.repeat(58)
const ADDR_C = 'C'.repeat(58)

describe('fetchAndPersistNames', () => {
    beforeEach(() => {
        registerFakeNameServiceAdapter()
        mockFetchAddressNames.mockReset()
        mockUpsertNameEntries.mockReset().mockResolvedValue(undefined)
        mockGetStaleOrMissingAddresses
            .mockReset()
            .mockImplementation(async ({ addresses }) => addresses)
    })

    it('is a no-op for empty input', async () => {
        await fetchAndPersistNames([], ALGORAND_MAINNET)
        expect(mockFetchAddressNames).not.toHaveBeenCalled()
        expect(mockUpsertNameEntries).not.toHaveBeenCalled()
    })

    it('filters invalid addresses before fetching', async () => {
        await fetchAndPersistNames(['not-an-address', ''], ALGORAND_MAINNET)
        expect(mockGetStaleOrMissingAddresses).not.toHaveBeenCalled()
        expect(mockFetchAddressNames).not.toHaveBeenCalled()
    })

    it('drops bad-checksum addresses but keeps the rest of the batch', async () => {
        // Mixed batch: one valid, one too short. The bad one must not sink
        // the request — bulk-read returns 400 if any single address is
        // invalid, so we filter strictly before sending.
        mockFetchAddressNames.mockResolvedValue([])
        await fetchAndPersistNames([ADDR_A, 'short'], ALGORAND_MAINNET)

        expect(mockFetchAddressNames).toHaveBeenCalledTimes(1)
        const sent = mockFetchAddressNames.mock.calls[0][0].addresses
        expect(sent).toEqual([ADDR_A])
    })

    it('deduplicates addresses before fetching', async () => {
        mockFetchAddressNames.mockResolvedValue([])
        await fetchAndPersistNames([ADDR_A, ADDR_A, ADDR_A], ALGORAND_MAINNET)
        expect(mockGetStaleOrMissingAddresses).toHaveBeenCalledTimes(1)
        const passed = mockGetStaleOrMissingAddresses.mock.calls[0][0].addresses
        expect(passed).toHaveLength(1)
    })

    it('skips fetch when all addresses are cached and fresh', async () => {
        mockGetStaleOrMissingAddresses.mockResolvedValue([])
        await fetchAndPersistNames([ADDR_A], ALGORAND_MAINNET)
        expect(mockFetchAddressNames).not.toHaveBeenCalled()
        expect(mockUpsertNameEntries).not.toHaveBeenCalled()
    })

    it('fetches stale/missing addresses and persists positive results', async () => {
        mockFetchAddressNames.mockResolvedValue([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])

        await fetchAndPersistNames([ADDR_A], ALGORAND_MAINNET)

        expect(mockFetchAddressNames).toHaveBeenCalledTimes(1)
        expect(mockUpsertNameEntries).toHaveBeenCalledTimes(1)
        const persisted = mockUpsertNameEntries.mock.calls[0][0].entries
        expect(persisted).toEqual([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])
    })

    it('persists nothing when the backend cannot answer, so an outage is not cached as no name', async () => {
        mockFetchAddressNames.mockRejectedValue(new Error('503'))

        await fetchAndPersistNames([ADDR_A], ALGORAND_MAINNET)

        expect(mockUpsertNameEntries).not.toHaveBeenCalled()
    })

    it('matches a hit answered in a different case than the address asked', async () => {
        mockFetchAddressNames.mockResolvedValue([
            {
                address: ADDR_A.toLowerCase(),
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])

        await fetchAndPersistNames([ADDR_A], ALGORAND_MAINNET)

        const persisted = mockUpsertNameEntries.mock.calls[0][0].entries
        expect(persisted).toEqual([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
        ])
    })

    it('persists negative results for addresses absent from response', async () => {
        mockFetchAddressNames.mockResolvedValue([
            {
                address: ADDR_A,
                name: { name: 'alice.algo', image: '', source: 'nfd' },
            },
            // ADDR_B intentionally absent
        ])

        await fetchAndPersistNames([ADDR_A, ADDR_B], ALGORAND_MAINNET)

        const persisted = mockUpsertNameEntries.mock.calls[0][0].entries
        const entryB = persisted.find(
            (e: { address: string }) => e.address === ADDR_B,
        )
        expect(entryB).toBeDefined()
        expect(entryB.name).toBeNull()
    })

    it('chunks requests larger than NAME_BULK_CHUNK_SIZE', async () => {
        const unique = Array.from(
            { length: NAME_BULK_CHUNK_SIZE + 5 },
            (_, i) => makeAddress(i),
        )
        expect(new Set(unique).size).toBe(unique.length)
        mockFetchAddressNames.mockResolvedValue([])

        await fetchAndPersistNames(unique, ALGORAND_MAINNET)

        expect(mockFetchAddressNames).toHaveBeenCalledTimes(2)
        const first = mockFetchAddressNames.mock.calls[0][0].addresses.length
        const second = mockFetchAddressNames.mock.calls[1][0].addresses.length
        expect(first + second).toBe(unique.length)
        expect(first).toBeLessThanOrEqual(NAME_BULK_CHUNK_SIZE)
        expect(second).toBeLessThanOrEqual(NAME_BULK_CHUNK_SIZE)
    })

    it('does not write cache rows when fetch fails', async () => {
        mockFetchAddressNames.mockRejectedValue(new Error('boom'))
        await fetchAndPersistNames([ADDR_C], ALGORAND_MAINNET)
        expect(mockUpsertNameEntries).not.toHaveBeenCalled()
    })

    it('isolates failures across batches', async () => {
        const unique = Array.from(
            { length: NAME_BULK_CHUNK_SIZE + 1 },
            (_, i) => makeAddress(i),
        )
        // First batch fails, second batch (1 address) succeeds
        mockFetchAddressNames
            .mockRejectedValueOnce(new Error('first batch boom'))
            .mockResolvedValueOnce([])

        await fetchAndPersistNames(unique, ALGORAND_MAINNET)

        // The successful batch should still write
        expect(mockUpsertNameEntries).toHaveBeenCalledTimes(1)
    })
})

describe('non-Pera-backed networks', () => {
    beforeEach(() => {
        mockFetchAddressNames.mockReset()
        mockUpsertNameEntries.mockReset().mockResolvedValue(undefined)
        mockGetStaleOrMissingAddresses
            .mockReset()
            .mockImplementation(async ({ addresses }) => addresses)
    })

    it.each(['betanet', 'custom'])('writes nothing on %s', async network => {
        await fetchAndPersistNames([ADDR_A], {
            chainId: 'algorand',
            networkId: network,
        })

        expect(mockFetchAddressNames).not.toHaveBeenCalled()
        expect(mockUpsertNameEntries).not.toHaveBeenCalled()
    })

    it('still persists misses as null on mainnet', async () => {
        mockFetchAddressNames.mockResolvedValue([])

        await fetchAndPersistNames([ADDR_A], ALGORAND_MAINNET)

        expect(mockUpsertNameEntries).toHaveBeenCalledTimes(1)
        const persisted = mockUpsertNameEntries.mock.calls[0][0].entries
        expect(persisted).toEqual([{ address: ADDR_A, name: null }])
    })
})
