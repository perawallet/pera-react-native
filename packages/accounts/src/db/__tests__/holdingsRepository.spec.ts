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
    getHoldingRestriction,
    insertAssetHolding,
    addToAssetHolding,
    deleteAssetHoldings,
    getAllHeldAssetIdsForNetwork,
    getAssetHolderAddresses,
    getHeldAssetIdsByAccount,
    deleteAllAssetHoldingsForAccount,
} from '../holdingsRepository'
import { addAccountToken } from '../addedTokensRepository'
import { getAccountHoldingsPage } from '../holdingsQueries'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const
const TESTNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'testnet',
} as const

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

    describe('added tokens', () => {
        const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        const amountOf = async () =>
            (
                await getAccountHoldings({
                    db,
                    accountAddress: 'A',
                    scope: ETHEREUM,
                })
            )
                .find(h => h.assetId === TOKEN)
                ?.amount.toFixed()

        it('keeps a token added during the read at zero', async () => {
            await addAccountToken({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })
            await insertAssetHolding({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'A',
                holdings: [],
                scope: ETHEREUM,
            })

            expect(await amountOf()).toBe('0')
        })

        it('writes a zero row for an added token that has no holding row', async () => {
            await addAccountToken({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'A',
                holdings: [],
                scope: ETHEREUM,
            })

            expect(changed).toBe(true)
            expect(await amountOf()).toBe('0')
        })

        it('keeps the balance the chain read for an added token', async () => {
            await addAccountToken({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'A',
                holdings: [{ assetId: TOKEN, amount: new Decimal(7) }],
                scope: ETHEREUM,
            })

            expect(await amountOf()).toBe('7')
        })

        it('brings an added token back to zero once its balance is spent', async () => {
            await addAccountToken({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })
            await insertAssetHolding({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
                amount: new Decimal(5),
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'A',
                holdings: [],
                scope: ETHEREUM,
            })

            expect(await amountOf()).toBe('0')
        })

        it('lets a removed token go even when the read still listed it at zero', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId: TOKEN,
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'A',
                holdings: [],
                scope: ETHEREUM,
            })

            expect(await amountOf()).toBeUndefined()
        })
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
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 999n }],
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
            expect(result[0].amount).toEqual(new Decimal(999))
        })

        it('round-trips native holding data and reports a native-only change', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    {
                        assetId: '100',
                        amount: new Decimal(5000),
                        native: { family: 'algorand', isFrozen: true },
                    },
                ],
                scope: MAINNET_SCOPE,
            })

            const page = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(page[0].native).toEqual({
                family: 'algorand',
                isFrozen: true,
            })

            // Same amount, different native data — must still be a change.
            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    {
                        assetId: '100',
                        amount: new Decimal(5000),
                        native: { family: 'algorand', isFrozen: false },
                    },
                ],
                scope: MAINNET_SCOPE,
            })
            expect(changed).toBe(true)

            const after = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(after[0].native).toEqual({
                family: 'algorand',
                isFrozen: false,
            })
        })

        it('writes nothing when the native data is unchanged', async () => {
            const holdings = () => [
                {
                    assetId: '100',
                    amount: new Decimal(5000),
                    native: { family: 'algorand' as const, isFrozen: false },
                },
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: holdings(),
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: holdings(),
                scope: MAINNET_SCOPE,
            })

            expect(changed).toBe(false)
        })

        it('handles empty holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n }],
                scope: MAINNET_SCOPE,
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [],
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(0)
        })

        it('isolates holdings by account and network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '200', amount: 20n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 30n }],
                scope: TESTNET_SCOPE,
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: TESTNET_SCOPE,
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    scope: TESTNET_SCOPE,
                }),
            ).toHaveLength(0)
        })

        it('returns empty array for unknown account', async () => {
            const result = await getAccountHoldings({
                db,
                accountAddress: 'UNKNOWN',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(999) },
                ],
                scope: MAINNET_SCOPE,
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                scope: MAINNET_SCOPE,
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(result.map(r => r.assetId)).toEqual(['100'])
        })

        it('keeps a retained holding the incoming set omits, and still removes the rest', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: 'kept/1', amount: new Decimal(1) },
                    { assetId: '200', amount: new Decimal(20) },
                ],
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                scope: MAINNET_SCOPE,
                retain: assetId => assetId.startsWith('kept/'),
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(result.map(r => r.assetId).sort()).toEqual(['100', 'kept/1'])
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
                scope: MAINNET_SCOPE,
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(result).toHaveLength(450)
        })

        it('returns false on a repeat sync of an unchanged frozen holding', async () => {
            const holdings = [
                {
                    assetId: '100',
                    amount: new Decimal(10),
                    native: { family: 'algorand' as const, isFrozen: true },
                },
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                scope: MAINNET_SCOPE,
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })
            await upsertAssets({
                db,
                items: [
                    makeAsset('100', PeraAssetType.standard_asset),
                    makeAsset('200', PeraAssetType.standard_asset),
                    makeAsset('300', PeraAssetType.collectible),
                    makeAsset('400', PeraAssetType.collectible),
                ],
                scope: MAINNET_SCOPE,
            })
        })

        const idsOf = async (filters: Record<string, unknown>) => {
            const rows = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
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

        it('hideZeroBalanceNfts excludes only zero-balance collectibles', async () => {
            // Owned NFT '300' is kept, opted-in '400' is dropped, unknown '500' kept.
            expect(await idsOf({ hideZeroBalanceNfts: true })).toEqual([
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

        it('combines hideZeroBalance with hideZeroBalanceNfts', async () => {
            // hideZeroBalance drops '200', '400', '500'; hideZeroBalanceNfts is
            // already covered by hideZeroBalance for collectibles.
            expect(
                await idsOf({
                    hideZeroBalance: true,
                    hideZeroBalanceNfts: true,
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
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(new Decimal(0))
        })

        it('stores the given base-unit amount', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
                amount: new Decimal('12345678901234567890'),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result[0].amount).toEqual(
                new Decimal('12345678901234567890'),
            )
        })

        it('does not overwrite existing holding on conflict', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 500n }],
                scope: MAINNET_SCOPE,
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(500))
        })

        it('adds alongside existing holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                scope: MAINNET_SCOPE,
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '200',
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })

        it('stores no native data when the caller omits it', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result[0].native).toBeNull()
        })
    })

    describe('getHoldingRestriction', () => {
        const seed = async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [
                    {
                        assetId: '100',
                        amount: new Decimal(1),
                        native: { family: 'algorand', isFrozen: true },
                    },
                    {
                        assetId: '200',
                        amount: new Decimal(2),
                        native: { family: 'algorand', isFrozen: false },
                    },
                    { assetId: '300', amount: new Decimal(3) },
                ],
            })
        }

        const restrictionOf = (
            assetId: string,
            accountAddress = 'ADDR1',
            scope = MAINNET_SCOPE,
        ) => getHoldingRestriction({ db, accountAddress, assetId, scope })

        it('blocks transfers of a frozen holding', async () => {
            await seed()

            await expect(restrictionOf('100')).resolves.toBe('transferBlocked')
        })

        it('is null for a holding that is not frozen', async () => {
            await seed()

            await expect(restrictionOf('200')).resolves.toBeNull()
        })

        it('is null for a holding with no native data', async () => {
            await seed()

            await expect(restrictionOf('300')).resolves.toBeNull()
        })

        it('is null when there is no holding row, so nothing restricts it', async () => {
            await seed()

            await expect(restrictionOf('999')).resolves.toBeNull()
        })

        it('scopes to the account and network', async () => {
            await seed()

            await expect(restrictionOf('100', 'ADDR2')).resolves.toBeNull()
            await expect(
                restrictionOf('100', 'ADDR1', TESTNET_SCOPE),
            ).resolves.toBeNull()
        })
    })

    describe('addToAssetHolding', () => {
        it('inserts a new holding carrying the credited amount', async () => {
            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(750))
        })

        it('leaves other accounts and assets untouched', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 20n }],
                scope: MAINNET_SCOPE,
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                scope: MAINNET_SCOPE,
                amount: new Decimal(5),
            })

            const addr1 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            const addr2 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100', '200'],
                scope: MAINNET_SCOPE,
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
        })

        it('does not affect other accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 0n }],
                scope: MAINNET_SCOPE,
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(1)
        })

        it('does not affect other networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                scope: TESTNET_SCOPE,
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: TESTNET_SCOPE,
                }),
            ).toHaveLength(1)
        })

        it('handles empty assetIds array', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                scope: MAINNET_SCOPE,
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: [],
                scope: MAINNET_SCOPE,
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: MAINNET_SCOPE,
                }),
            ).toHaveLength(1)
        })
    })

    describe('per-account cleanup helpers', () => {
        it('getHeldAssetIdsByAccount returns the account holdings across networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5n },
                    { assetId: '200', amount: 0n },
                ],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                scope: TESTNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '999', amount: 1n }],
                scope: MAINNET_SCOPE,
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
                { assetId: '100', network: 'algorand/mainnet' },
                { assetId: '200', network: 'algorand/mainnet' },
                { assetId: '300', network: 'algorand/testnet' },
            ])
        })

        it('deleteAllAssetHoldingsForAccount removes only that account holdings on all networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                scope: TESTNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 9n }],
                scope: MAINNET_SCOPE,
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
            expect(addr2).toEqual([
                { assetId: '100', network: 'algorand/mainnet' },
            ])
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
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [
                    { assetId: '200', amount: 30n },
                    { assetId: '300', amount: 40n },
                ],
                scope: MAINNET_SCOPE,
            })

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual(['100', '200', '300'])
        })
    })

    describe('getAssetHolderAddresses', () => {
        it('returns owners before zero-balance accounts, scoped to the network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OPTED_IN',
                holdings: [{ assetId: '500', amount: 0n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OWNER',
                holdings: [{ assetId: '500', amount: 1n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OTHER_NETWORK',
                holdings: [{ assetId: '500', amount: 1n }],
                scope: TESTNET_SCOPE,
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual(['ADDR_OWNER', 'ADDR_OPTED_IN'])
        })

        it('orders same-status holders by address so repeated lookups agree', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_B',
                holdings: [{ assetId: '500', amount: 1n }],
                scope: MAINNET_SCOPE,
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_A',
                holdings: [{ assetId: '500', amount: 1n }],
                scope: MAINNET_SCOPE,
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual(['ADDR_A', 'ADDR_B'])
        })

        it('returns an empty list for an asset no account holds', async () => {
            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual([])
        })
    })
})
