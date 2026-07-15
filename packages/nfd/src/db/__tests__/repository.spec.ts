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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertNfdEntries,
    getNfdByAddress,
    getNfdsByAddresses,
    getStaleOrMissingAddresses,
} from '../repository'

const ADDR_A = 'A'.repeat(58)
const ADDR_B = 'B'.repeat(58)
const ADDR_C = 'C'.repeat(58)

describe('nfd repository', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
        vi.useRealTimers()
    })

    describe('upsertNfdEntries + getNfdByAddress', () => {
        it('persists positive entries and reads them back', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: {
                            name: 'alice.algo',
                            image: 'img://a',
                            source: 'nfd',
                        },
                    },
                ],
            })

            const row = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })

            expect(row).not.toBeNull()
            expect(row?.name?.name).toBe('alice.algo')
            expect(row?.name?.image).toBe('img://a')
            expect(row?.name?.source).toBe('nfd')
        })

        it('persists negative entries (no NFD) as cached null', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [{ address: ADDR_A, name: null }],
            })

            const row = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })

            expect(row).not.toBeNull()
            expect(row?.name).toBeNull()
        })

        it('returns null for unknown addresses', async () => {
            const row = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })
            expect(row).toBeNull()
        })

        it('upsert overwrites existing rows and bumps updatedAt', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: {
                            name: 'alice.algo',
                            image: '',
                            source: 'nfd',
                        },
                    },
                ],
            })
            const first = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })

            vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: {
                            name: 'alice2.algo',
                            image: '',
                            source: 'nfd',
                        },
                    },
                ],
            })
            const second = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })

            expect(second?.name?.name).toBe('alice2.algo')
            expect(second?.updatedAt).toBeGreaterThan(first!.updatedAt)
        })

        it('isolates entries per network', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: {
                            name: 'alice.algo',
                            image: '',
                            source: 'nfd',
                        },
                    },
                ],
            })
            await upsertNfdEntries({
                db,
                network: 'testnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: {
                            name: 'alice.testnet',
                            image: '',
                            source: 'nfd',
                        },
                    },
                ],
            })

            const mainnetRow = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })
            const testnetRow = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'testnet',
            })

            expect(mainnetRow?.name?.name).toBe('alice.algo')
            expect(testnetRow?.name?.name).toBe('alice.testnet')
        })

        it('no-op on empty entries', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [],
            })
            const row = await getNfdByAddress({
                db,
                address: ADDR_A,
                network: 'mainnet',
            })
            expect(row).toBeNull()
        })
    })

    describe('getNfdsByAddresses', () => {
        it('returns rows for the requested subset only', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: { name: 'a.algo', image: '', source: 'nfd' },
                    },
                    {
                        address: ADDR_B,
                        name: { name: 'b.algo', image: '', source: 'nfd' },
                    },
                ],
            })

            const rows = await getNfdsByAddresses({
                db,
                addresses: [ADDR_A, ADDR_C],
                network: 'mainnet',
            })

            expect(rows).toHaveLength(1)
            expect(rows[0].address).toBe(ADDR_A)
        })

        it('returns empty array for empty input', async () => {
            const rows = await getNfdsByAddresses({
                db,
                addresses: [],
                network: 'mainnet',
            })
            expect(rows).toEqual([])
        })
    })

    describe('getStaleOrMissingAddresses', () => {
        it('returns missing addresses', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: { name: 'a.algo', image: '', source: 'nfd' },
                    },
                ],
            })

            const result = await getStaleOrMissingAddresses({
                db,
                addresses: [ADDR_A, ADDR_B, ADDR_C],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result.sort()).toEqual([ADDR_B, ADDR_C].sort())
        })

        it('returns stale addresses past TTL', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: { name: 'a.algo', image: '', source: 'nfd' },
                    },
                ],
            })

            // Advance past TTL
            vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
            const result = await getStaleOrMissingAddresses({
                db,
                addresses: [ADDR_A],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual([ADDR_A])
        })

        it('skips fresh addresses regardless of positive or negative cache', async () => {
            await upsertNfdEntries({
                db,
                network: 'mainnet',
                entries: [
                    {
                        address: ADDR_A,
                        name: { name: 'a.algo', image: '', source: 'nfd' },
                    },
                    { address: ADDR_B, name: null },
                ],
            })

            const result = await getStaleOrMissingAddresses({
                db,
                addresses: [ADDR_A, ADDR_B],
                network: 'mainnet',
                ttlMs: 60 * 60 * 1000,
            })

            expect(result).toEqual([])
        })
    })
})
