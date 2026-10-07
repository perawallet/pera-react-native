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
    registerAccountCleanup,
    resetAccountCleanupRegistry,
} from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertAssets,
    upsertAssetPrices,
    getAssetsByIds,
    getAssetPricesByIds,
    seedNativeAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    scopeForLegacyNetwork,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    AccountAssetHoldingsSchema,
    refreshAccountHoldings,
    upsertAccountBalance,
    getAccountBalance,
    upsertAccountChainState,
    getAccountChainStateRow,
    getHeldAssetIdsByAccount,
} from '../../db'
import {
    getAccountChainState,
    useAccountChainStateStore,
} from '../../store/accountChainState'
import { cleanupRemovedAccountData } from '../cleanupRemovedAccountData'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')
const TESTNET_SCOPE = scopeForLegacyNetwork('testnet')

const makeAsset = (assetId: string): PeraAsset => ({
    assetId,
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal('1000000'),
    name: `Asset ${assetId}`,
    unitName: 'AST',
})

const balanceArgs = (
    db: Database,
    accountAddress: string,
    scope: ChainScope,
) => ({
    db,
    accountAddress,
    scope,
    algoBalance: new Decimal('1'),
    totalAssetsOptedIn: 0,
    totalCreatedAssets: 0,
    totalAppsOptedIn: 0,
    minBalance: new Decimal('0.1'),
    status: 'Offline',
    authAddress: null,
})

describe('cleanupRemovedAccountData', () => {
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
        resetAccountCleanupRegistry()
        useAccountChainStateStore.getState().resetState()
    })

    it('drops the removed account from every chain-state scope and keeps others', async () => {
        const state = {
            family: 'algorand' as const,
            minBalance: new Decimal(0),
            status: 'Offline' as const,
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
        }
        const slice = useAccountChainStateStore.getState()
        slice.setAccountChainState(MAINNET_SCOPE, 'ADDR1', state)
        slice.setAccountChainState(TESTNET_SCOPE, 'ADDR1', state)
        slice.setAccountChainState(MAINNET_SCOPE, 'ADDR2', state)

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(getAccountChainState(MAINNET_SCOPE, 'ADDR1')).toBeUndefined()
        expect(getAccountChainState(TESTNET_SCOPE, 'ADDR1')).toBeUndefined()
        expect(getAccountChainState(MAINNET_SCOPE, 'ADDR2')).toBeDefined()
    })

    it('runs registered account cleanup handlers with the db and address', async () => {
        const handler = vi.fn().mockResolvedValue(undefined)
        registerAccountCleanup(handler)

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(handler).toHaveBeenCalledWith({ db, accountAddress: 'ADDR1' })
    })

    it('finishes the cleanup when a stored network is not a known scope', async () => {
        const handler = vi.fn().mockResolvedValue(undefined)
        registerAccountCleanup(handler)
        await upsertAssets({
            db,
            items: [makeAsset('100')],
            scope: MAINNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            scope: MAINNET_SCOPE,
        })
        await db
            .insert(AccountAssetHoldingsSchema)
            .values({
                accountAddress: 'ADDR1',
                assetId: '200',
                network: 'unknown/devnet' as ChainScopeKey,
                updatedAt: Date.now(),
            })
            .run()

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(result.prunedAssetIdsByNetwork).toEqual({
            'algorand/mainnet': ['100'],
        })
        expect(handler).toHaveBeenCalledWith({ db, accountAddress: 'ADDR1' })
    })

    it('removes the account holdings, balance and chain-state rows', async () => {
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            scope: MAINNET_SCOPE,
        })
        await upsertAccountBalance(balanceArgs(db, 'ADDR1', MAINNET_SCOPE))
        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(1_000_000),
            chainData: { family: 'evm' },
        })

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(
            await getHeldAssetIdsByAccount({ db, accountAddress: 'ADDR1' }),
        ).toEqual([])
        expect(
            await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            }),
        ).toBeUndefined()
        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            }),
        ).toBeUndefined()
    })

    it('prunes assets + prices held only by the removed account', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100')],
            scope: MAINNET_SCOPE,
        })
        await upsertAssetPrices({
            db,
            prices: [{ assetId: '100', usdPrice: new Decimal('1.5') }],
            scope: MAINNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            scope: MAINNET_SCOPE,
        })

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(
            await getAssetsByIds({
                db,
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            }),
        ).toHaveLength(0)
        expect(
            await getAssetPricesByIds({
                db,
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            }),
        ).toHaveLength(0)
        expect(result.prunedAssetIdsByNetwork).toEqual({
            'algorand/mainnet': ['100'],
        })
    })

    it('keeps assets another account still holds or is opted into', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100'), makeAsset('200'), makeAsset('400')],
            scope: MAINNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [
                { assetId: '100', amount: 5n },
                { assetId: '200', amount: 5n },
                { assetId: '400', amount: 5n },
            ],
            scope: MAINNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR2',
            holdings: [
                { assetId: '200', amount: 9n },
                { assetId: '400', amount: 0n },
            ],
            scope: MAINNET_SCOPE,
        })

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(
            await getAssetsByIds({
                db,
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            }),
        ).toHaveLength(0)
        const kept = await getAssetsByIds({
            db,
            assetIds: ['200', '400'],
            scope: MAINNET_SCOPE,
        })
        expect(kept.map(a => a.assetId).sort()).toEqual(['200', '400'])
    })

    it('prunes orphans per network independently', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100')],
            scope: MAINNET_SCOPE,
        })
        await upsertAssets({
            db,
            items: [makeAsset('300')],
            scope: TESTNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            scope: MAINNET_SCOPE,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '300', amount: 5n }],
            scope: TESTNET_SCOPE,
        })

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(
            await getAssetsByIds({
                db,
                assetIds: ['100'],
                scope: MAINNET_SCOPE,
            }),
        ).toHaveLength(0)
        expect(
            await getAssetsByIds({
                db,
                assetIds: ['300'],
                scope: TESTNET_SCOPE,
            }),
        ).toHaveLength(0)
        expect(result.networksAffected.sort()).toEqual([
            'algorand/mainnet',
            'algorand/testnet',
        ])
    })

    it('keeps the seeded native row when the last account holding it goes', async () => {
        await seedNativeAssets(db)
        await upsertAssetPrices({
            db,
            prices: [{ assetId: '0', usdPrice: new Decimal('0.2') }],
            scope: MAINNET_SCOPE,
        })
        // The syncer persists ALGO as an ordinary holding row, so it lands in
        // the removed account's held-id set like any ASA.
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '0', amount: 5_000_000n }],
            scope: MAINNET_SCOPE,
        })

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(
            await getAssetsByIds({ db, assetIds: ['0'], scope: MAINNET_SCOPE }),
        ).toHaveLength(1)
        expect(
            await getAssetPricesByIds({
                db,
                assetIds: ['0'],
                scope: MAINNET_SCOPE,
            }),
        ).toHaveLength(1)
        expect(result.prunedAssetIdsByNetwork).toEqual({})
    })

    it('is a no-op for an account with no data', async () => {
        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'GHOST',
        })
        expect(result.networksAffected).toEqual([])
        expect(result.prunedAssetIdsByNetwork).toEqual({})
    })
})
