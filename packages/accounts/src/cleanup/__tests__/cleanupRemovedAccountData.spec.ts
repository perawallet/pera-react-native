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
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    refreshAccountHoldings,
    upsertAccountBalance,
    getAccountBalance,
    getHeldAssetIdsByAccount,
} from '../../db'
import { cleanupRemovedAccountData } from '../cleanupRemovedAccountData'

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
    network: string,
) => ({
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
    })

    it('runs registered account cleanup handlers with the db and address', async () => {
        const handler = vi.fn().mockResolvedValue(undefined)
        registerAccountCleanup(handler)

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(handler).toHaveBeenCalledWith({ db, accountAddress: 'ADDR1' })
    })

    it('removes the account holdings and balance row', async () => {
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            network: 'mainnet',
        })
        await upsertAccountBalance(balanceArgs(db, 'ADDR1', 'mainnet'))

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(
            await getHeldAssetIdsByAccount({ db, accountAddress: 'ADDR1' }),
        ).toEqual([])
        expect(
            await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            }),
        ).toBeUndefined()
    })

    it('prunes assets + prices held only by the removed account', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100')],
            network: 'mainnet',
        })
        await upsertAssetPrices({
            db,
            prices: [{ assetId: '100', usdPrice: new Decimal('1.5') }],
            network: 'mainnet',
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            network: 'mainnet',
        })

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(
            await getAssetsByIds({ db, assetIds: ['100'], network: 'mainnet' }),
        ).toHaveLength(0)
        expect(
            await getAssetPricesByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            }),
        ).toHaveLength(0)
        expect(result.prunedAssetIdsByNetwork).toEqual({ mainnet: ['100'] })
    })

    it('keeps assets another account still holds or is opted into', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100'), makeAsset('200'), makeAsset('400')],
            network: 'mainnet',
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [
                { assetId: '100', amount: 5n },
                { assetId: '200', amount: 5n },
                { assetId: '400', amount: 5n },
            ],
            network: 'mainnet',
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR2',
            holdings: [
                { assetId: '200', amount: 9n },
                { assetId: '400', amount: 0n },
            ],
            network: 'mainnet',
        })

        await cleanupRemovedAccountData({ db, accountAddress: 'ADDR1' })

        expect(
            await getAssetsByIds({ db, assetIds: ['100'], network: 'mainnet' }),
        ).toHaveLength(0)
        const kept = await getAssetsByIds({
            db,
            assetIds: ['200', '400'],
            network: 'mainnet',
        })
        expect(kept.map(a => a.assetId).sort()).toEqual(['200', '400'])
    })

    it('prunes orphans per network independently', async () => {
        await upsertAssets({
            db,
            items: [makeAsset('100')],
            network: 'mainnet',
        })
        await upsertAssets({
            db,
            items: [makeAsset('300')],
            network: 'testnet',
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: 5n }],
            network: 'mainnet',
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '300', amount: 5n }],
            network: 'testnet',
        })

        const result = await cleanupRemovedAccountData({
            db,
            accountAddress: 'ADDR1',
        })

        expect(
            await getAssetsByIds({ db, assetIds: ['100'], network: 'mainnet' }),
        ).toHaveLength(0)
        expect(
            await getAssetsByIds({ db, assetIds: ['300'], network: 'testnet' }),
        ).toHaveLength(0)
        expect(result.networksAffected.sort()).toEqual(['mainnet', 'testnet'])
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
