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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertAssets,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    refreshAccountHoldings,
    getAccountHoldings,
    isAssetFrozen,
    insertAssetHolding,
    addToAssetHolding,
    deleteAssetHoldings,
    getAllHeldAssetIdsForNetwork,
    getAssetHolderAddresses,
    getHeldAssetIdsByAccount,
    deleteAllAssetHoldingsForAccount,
} from '../holdingsRepository'
import { getAccountHoldingsPage } from '../holdingsQueries'
import {
    upsertAccountBalance,
    getAccountBalance,
    deleteAccountBalance,
} from '../balancesRepository'

describe('account holdings repository', () => {
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
    })

    describe('holdings', () => {
        it('inserts and retrieves holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5000n },
                    { assetId: '200', amount: 300n },
                ],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })

        it('replaces all holdings on upsert', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5000n },
                    { assetId: '200', amount: 300n },
                ],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 999n }],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
            expect(result[0].amount).toEqual(new Decimal(999))
        })

        it('persists the frozen flag and reports an isFrozen-only change', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n, isFrozen: true }],
                network: 'mainnet',
            })

            const page = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(page[0].isFrozen).toBe(true)

            // Unfreeze with the same amount — must still be detected as a change.
            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n, isFrozen: false }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const after = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(after[0].isFrozen).toBe(false)
        })

        it('handles empty holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n }],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })

        it('isolates holdings by account and network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '200', amount: 20n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 30n }],
                network: 'testnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'testnet',
                }),
            ).toHaveLength(0)
        })

        it('returns empty array for unknown account', async () => {
            const result = await getAccountHoldings({
                db,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })
    })

    describe('refreshAccountHoldings diff semantics', () => {
        it('returns true when holdings are first written', async () => {
            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)
        })

        it('returns false when nothing changed', async () => {
            const holdings = [
                { assetId: '100', amount: new Decimal(10) },
                { assetId: '200', amount: new Decimal(20) },
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })
            expect(changed).toBe(false)
        })

        it('returns true and updates only the changed amount', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(20) },
                ],
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(999) },
                ],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            const byId = new Map(result.map(r => [r.assetId, r.amount]))
            expect(byId.get('100')).toEqual(new Decimal(10))
            expect(byId.get('200')).toEqual(new Decimal(999))
        })

        it('returns true and removes holdings dropped from the incoming set', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(20) },
                ],
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(result.map(r => r.assetId)).toEqual(['100'])
        })

        it('writes a large holding set across multiple batches', async () => {
            const holdings = Array.from({ length: 450 }, (_, i) => ({
                assetId: `${i + 1}`,
                amount: new Decimal(i + 1),
            }))

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(result).toHaveLength(450)
        })

        it('returns false on a repeat sync of an unchanged frozen holding', async () => {
            const holdings = [
                { assetId: '100', amount: new Decimal(10), isFrozen: true },
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })
            expect(changed).toBe(false)
        })
    })

    describe('getAccountHoldings filters', () => {
        // Holdings layout used by the filter tests below:
        //   '100' - standard asset, non-zero amount
        //   '200' - standard asset, zero amount
        //   '300' - collectible (NFT), non-zero amount (owned NFT)
        //   '400' - collectible (NFT), zero amount (opted-in but not owned)
        //   '500' - unknown asset (no row in assets_pera) — should always be kept
        //           when filters do not explicitly exclude it
        const makeAsset = (
            assetId: string,
            type: (typeof PeraAssetType)[keyof typeof PeraAssetType],
        ): PeraAsset => ({
            assetId,
            decimals: 0,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1),
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                type,
            },
        })

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(50) },
                    { assetId: '200', amount: new Decimal(0) },
                    { assetId: '300', amount: new Decimal(1) },
                    { assetId: '400', amount: new Decimal(0) },
                    { assetId: '500', amount: new Decimal(0) },
                ],
                network: 'mainnet',
            })
            await upsertAssets({
                db,
                items: [
                    makeAsset('100', PeraAssetType.standard_asset),
                    makeAsset('200', PeraAssetType.standard_asset),
                    makeAsset('300', PeraAssetType.collectible),
                    makeAsset('400', PeraAssetType.collectible),
                ],
                network: 'mainnet',
            })
        })

        const idsOf = async (filters: Record<string, unknown>) => {
            const rows = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                ...filters,
            })
            return rows.map(r => r.assetId).sort()
        }

        it('returns all holdings when no filters are provided', async () => {
            expect(await idsOf({})).toEqual(['100', '200', '300', '400', '500'])
        })

        it('hideZeroBalance excludes rows with amount equal to zero', async () => {
            expect(await idsOf({ hideZeroBalance: true })).toEqual([
                '100',
                '300',
            ])
        })

        it('hideNfts excludes all collectibles but keeps unknown asset types', async () => {
            expect(await idsOf({ hideNfts: true })).toEqual([
                '100',
                '200',
                '500',
            ])
        })

        it('hideOptedInNfts excludes only zero-balance collectibles', async () => {
            // Owned NFT '300' is kept, opted-in '400' is dropped, unknown '500' kept.
            expect(await idsOf({ hideOptedInNfts: true })).toEqual([
                '100',
                '200',
                '300',
                '500',
            ])
        })

        it('combines hideZeroBalance with hideNfts', async () => {
            expect(
                await idsOf({ hideZeroBalance: true, hideNfts: true }),
            ).toEqual(['100'])
        })

        it('combines hideZeroBalance with hideOptedInNfts', async () => {
            // hideZeroBalance drops '200', '400', '500'; hideOptedInNfts is
            // already covered by hideZeroBalance for collectibles.
            expect(
                await idsOf({
                    hideZeroBalance: true,
                    hideOptedInNfts: true,
                }),
            ).toEqual(['100', '300'])
        })

        it('excludeAssetTypes still works for arbitrary type lists', async () => {
            expect(
                await idsOf({
                    excludeAssetTypes: [PeraAssetType.standard_asset],
                }),
            ).toEqual(['300', '400', '500'])
        })
    })

    describe('insertAssetHolding', () => {
        it('inserts a new holding with zero amount', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(new Decimal(0))
        })

        it('does not overwrite existing holding on conflict', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 500n }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(500))
        })

        it('adds alongside existing holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '200',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })

        it('defaults isFrozen to false when the caller omits it', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result[0].isFrozen).toBe(false)
        })
    })

    describe('isAssetFrozen', () => {
        const seed = async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '100', amount: new Decimal(1), isFrozen: true },
                    { assetId: '200', amount: new Decimal(2), isFrozen: false },
                ],
            })
        }

        it('is true for a frozen holding', async () => {
            await seed()

            await expect(
                isAssetFrozen({
                    db,
                    accountAddress: 'ADDR1',
                    assetId: '100',
                    network: 'mainnet',
                }),
            ).resolves.toBe(true)
        })

        it('is false for a holding that is not frozen', async () => {
            await seed()

            await expect(
                isAssetFrozen({
                    db,
                    accountAddress: 'ADDR1',
                    assetId: '200',
                    network: 'mainnet',
                }),
            ).resolves.toBe(false)
        })

        it('is false when there is no holding row — nothing to be frozen', async () => {
            await seed()

            await expect(
                isAssetFrozen({
                    db,
                    accountAddress: 'ADDR1',
                    assetId: '999',
                    network: 'mainnet',
                }),
            ).resolves.toBe(false)
        })

        it('scopes to the account and network', async () => {
            await seed()

            await expect(
                isAssetFrozen({
                    db,
                    accountAddress: 'ADDR2',
                    assetId: '100',
                    network: 'mainnet',
                }),
            ).resolves.toBe(false)
            await expect(
                isAssetFrozen({
                    db,
                    accountAddress: 'ADDR1',
                    assetId: '100',
                    network: 'testnet',
                }),
            ).resolves.toBe(false)
        })
    })

    describe('addToAssetHolding', () => {
        it('inserts a new holding carrying the credited amount', async () => {
            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(new Decimal(250))
        })

        it('adds to the existing amount when the holding exists', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 500n }],
                network: 'mainnet',
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(750))
        })

        it('leaves other accounts and assets untouched', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 20n }],
                network: 'mainnet',
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(5),
            })

            const addr1 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            const addr2 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
            })

            expect(addr1[0].amount).toEqual(new Decimal(15))
            expect(addr2[0].amount).toEqual(new Decimal(20))
        })
    })

    describe('deleteAssetHoldings', () => {
        it('deletes specified asset holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 0n },
                    { assetId: '200', amount: 0n },
                    { assetId: '300', amount: 0n },
                ],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100', '200'],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
        })

        it('does not affect other accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })

        it('does not affect other networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'testnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
        })

        it('handles empty assetIds array', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: [],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })
    })

    describe('per-account cleanup helpers', () => {
        const balanceArgs = (accountAddress: string, network: string) => ({
            db,
            accountAddress,
            network,
            algoBalance: new Decimal('1'),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Offline',
            authAddress: null,
        })

        it('getHeldAssetIdsByAccount returns the account holdings across networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5n },
                    { assetId: '200', amount: 0n },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                network: 'testnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '999', amount: 1n }],
                network: 'mainnet',
            })

            const held = await getHeldAssetIdsByAccount({
                db,
                accountAddress: 'ADDR1',
            })

            expect(
                [...held].sort((a, b) =>
                    `${a.network}:${a.assetId}`.localeCompare(
                        `${b.network}:${b.assetId}`,
                    ),
                ),
            ).toEqual([
                { assetId: '100', network: 'mainnet' },
                { assetId: '200', network: 'mainnet' },
                { assetId: '300', network: 'testnet' },
            ])
        })

        it('deleteAllAssetHoldingsForAccount removes only that account holdings on all networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                network: 'testnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 9n }],
                network: 'mainnet',
            })

            await deleteAllAssetHoldingsForAccount({
                db,
                accountAddress: 'ADDR1',
            })

            expect(
                await getHeldAssetIdsByAccount({ db, accountAddress: 'ADDR1' }),
            ).toEqual([])
            const addr2 = await getHeldAssetIdsByAccount({
                db,
                accountAddress: 'ADDR2',
            })
            expect(addr2).toEqual([{ assetId: '100', network: 'mainnet' }])
        })

        it('deleteAccountBalance removes the account balance row(s)', async () => {
            await upsertAccountBalance(balanceArgs('ADDR1', 'mainnet'))
            await upsertAccountBalance(balanceArgs('ADDR1', 'testnet'))
            await upsertAccountBalance(balanceArgs('ADDR2', 'mainnet'))

            await deleteAccountBalance({ db, accountAddress: 'ADDR1' })

            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toBeUndefined()
            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toBeUndefined()
            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toBeDefined()
        })
    })

    describe('getAllHeldAssetIdsForNetwork', () => {
        it('returns distinct asset IDs across accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 10n },
                    { assetId: '200', amount: 20n },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [
                    { assetId: '200', amount: 30n },
                    { assetId: '300', amount: 40n },
                ],
                network: 'mainnet',
            })

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                network: 'mainnet',
            })

            expect(result.sort()).toEqual(['100', '200', '300'])
        })

        it('returns ids in a stable ascending order', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '300', amount: 1n },
                    { assetId: '100', amount: 1n },
                    { assetId: '200', amount: 1n },
                ],
                network: 'mainnet',
            })

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                network: 'mainnet',
            })

            expect(result).toEqual(['100', '200', '300'])
        })
    })

    describe('getAssetHolderAddresses', () => {
        it('returns owners before opted-in-only accounts, scoped to the network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OPTED_IN',
                holdings: [{ assetId: '500', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OWNER',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OTHER_NETWORK',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'testnet',
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual(['ADDR_OWNER', 'ADDR_OPTED_IN'])
        })

        it('orders same-status holders by address so repeated lookups agree', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_B',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_A',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual(['ADDR_A', 'ADDR_B'])
        })

        it('returns an empty list for an asset no account holds', async () => {
            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual([])
        })
    })
})
