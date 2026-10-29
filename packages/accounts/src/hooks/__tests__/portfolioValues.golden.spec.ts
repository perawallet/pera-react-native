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

// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    PeraAssetType,
    upsertAssetPrices,
    upsertAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { testAccount } from '../../__tests__/accountFactory'
import { refreshAccountHoldings } from '../../db'
import { accountValueKey } from '../../models'
import { useAccountBalancesQuery } from '../useAccountBalancesQuery'
import { useAccountSummaryQuery } from '../useAccountSummaryQuery'
import { useAccountValueTotalsQuery } from '../useAccountValueTotalsQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const testDb = vi.hoisted(() => ({ current: null as Database | null }))

vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => testDb.current,
}))

// The syncer would reach the chain; the rows under test are seeded directly.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: () => true,
    useChainCapabilityCheck: () => () => true,
}))

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(async () => undefined),
    fetchAndPersistAccount: vi.fn(async () => undefined),
}))

const asset = (
    assetId: string,
    decimals: number,
    type: PeraAssetType,
    name: string,
): PeraAsset => ({
    assetId,
    decimals,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal(1_000_000_000),
    name,
    unitName: name.toUpperCase(),
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'unverified',
        isFavorited: false,
        isPriceAlertEnabled: false,
        type,
    },
})

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

const str = (value: Nullable<Decimal>) => (value === null ? null : `${value}`)

const first = testAccount('local', 'ADDR1', { id: 'ADDR1' })
const second = testAccount('local', 'ADDR2', { id: 'ADDR2' })

const readAll = async (accounts: (typeof first)[], address: string) => {
    const balances = renderHook(
        () => useAccountBalancesQuery(accounts, SCOPE),
        { wrapper: wrapper() },
    )
    const totals = renderHook(
        () => useAccountValueTotalsQuery(accounts, SCOPE),
        { wrapper: wrapper() },
    )
    const summary = renderHook(() => useAccountSummaryQuery(address, SCOPE), {
        wrapper: wrapper(),
    })
    await waitFor(() => {
        expect(balances.result.current.isPending).toBe(false)
        expect(totals.result.current.isPending).toBe(false)
        expect(summary.result.current.isPending).toBe(false)
    })
    return {
        balances: balances.result.current,
        totals: totals.result.current,
        summary: summary.result.current,
    }
}

describe('portfolio values for Algorand accounts', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        testDb.current = db
        await runMigrations(db, migrations)
        await upsertAssets({
            db,
            scope: SCOPE,
            items: [
                asset('0', 6, PeraAssetType.algo, 'Algo'),
                asset('100', 6, PeraAssetType.standard_asset, 'Banana'),
                asset('200', 2, PeraAssetType.standard_asset, 'Cherry'),
                asset('400', 3, PeraAssetType.standard_asset, 'Frozen'),
                asset('500', 0, PeraAssetType.collectible, 'Nft'),
            ],
        })
    })

    afterEach(() => {
        teardown()
        testDb.current = null
    })

    it('values a priced account across every hook', async () => {
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            scope: SCOPE,
            holdings: [
                { assetId: '0', amount: new Decimal(10_000_000) },
                { assetId: '100', amount: new Decimal(4_000_000) },
                { assetId: '200', amount: new Decimal(1500) },
                { assetId: '300', amount: new Decimal(777) },
                {
                    assetId: '400',
                    amount: new Decimal(2000),
                    native: { family: 'algorand', isFrozen: true },
                },
                { assetId: '500', amount: new Decimal(0) },
            ],
        })
        await upsertAssetPrices({
            db,
            scope: SCOPE,
            prices: [
                { assetId: '0', usdPrice: new Decimal('0.25') },
                { assetId: '100', usdPrice: new Decimal('0.5') },
                { assetId: '300', usdPrice: new Decimal('2') },
                { assetId: '400', usdPrice: new Decimal('1.25') },
            ],
        })

        const { balances, totals, summary } = await readAll([first], 'ADDR1')

        const account = balances.accountBalances.get('ADDR1')
        const holdings = Object.fromEntries(
            (account?.assetBalances ?? []).map(h => [
                h.assetId,
                {
                    amount: str(h.amount),
                    nativeValue: str(h.nativeValue),
                    usdPrice: str(h.usdPrice ?? null),
                    fiatValue: str(h.fiatValue),
                    restriction: h.restriction,
                    hasAsset: h.asset !== undefined,
                },
            ]),
        )
        expect(holdings).toEqual({
            '0': {
                amount: '10',
                nativeValue: '10',
                usdPrice: '0.25',
                fiatValue: '2.5',
                restriction: null,
                hasAsset: true,
            },
            '100': {
                amount: '4',
                nativeValue: '8',
                usdPrice: '0.5',
                fiatValue: '2',
                restriction: null,
                hasAsset: true,
            },
            '200': {
                amount: '15',
                nativeValue: null,
                usdPrice: '0',
                fiatValue: null,
                restriction: null,
                hasAsset: true,
            },
            '300': {
                amount: '0',
                nativeValue: null,
                usdPrice: '2',
                fiatValue: null,
                restriction: null,
                hasAsset: false,
            },
            '400': {
                amount: '2',
                nativeValue: '10',
                usdPrice: '1.25',
                fiatValue: '2.5',
                restriction: 'transferBlocked',
                hasAsset: true,
            },
            '500': {
                amount: '0',
                nativeValue: null,
                usdPrice: '0',
                fiatValue: null,
                restriction: null,
                hasAsset: true,
            },
        })
        expect({
            nativeValue: str(account?.nativeValue ?? null),
            usdValue: str(account?.usdValue ?? null),
            fiatValue: str(account?.fiatValue ?? null),
            portfolioNativeValue: str(balances.portfolioNativeValue),
        }).toEqual({
            nativeValue: '28',
            usdValue: '7',
            fiatValue: '7',
            portfolioNativeValue: '28',
        })

        const total = totals.accountValueTotals.get(
            accountValueKey('algorand', 'ADDR1'),
        )
        expect({
            nativeValue: str(total?.nativeValue ?? null),
            usdValue: str(total?.usdValue ?? null),
            fiatValue: str(total?.fiatValue ?? null),
            portfolioNativeValue: str(totals.portfolioNativeValue),
            portfolioUsdValue: str(totals.portfolioUsdValue),
        }).toEqual({
            nativeValue: '28',
            usdValue: '7',
            fiatValue: '7',
            portfolioNativeValue: '28',
            portfolioUsdValue: '7',
        })

        expect({
            nativeAmount: str(summary.nativeAmount),
            portfolioUsdValue: str(summary.portfolioUsdValue),
            portfolioNativeValue: str(summary.portfolioNativeValue),
            holdingsCount: summary.holdingsCount,
            isComplete: summary.isComplete,
        }).toEqual({
            nativeAmount: '10',
            portfolioUsdValue: '7',
            portfolioNativeValue: '28',
            holdingsCount: 6,
            isComplete: false,
        })
    })

    it('leaves an unpriced native balance unknown rather than zero', async () => {
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR2',
            scope: SCOPE,
            holdings: [
                { assetId: '0', amount: new Decimal(3_000_000) },
                { assetId: '100', amount: new Decimal(1_000_000) },
            ],
        })
        await upsertAssetPrices({
            db,
            scope: SCOPE,
            prices: [{ assetId: '100', usdPrice: new Decimal('0.5') }],
        })

        const { balances, totals, summary } = await readAll([second], 'ADDR2')

        const account = balances.accountBalances.get('ADDR2')
        expect({
            nativeValue: str(account?.nativeValue ?? null),
            usdValue: str(account?.usdValue ?? null),
            fiatValue: str(account?.fiatValue ?? null),
            nativeFiat: str(
                account?.assetBalances.find(h => h.assetId === '0')
                    ?.fiatValue ?? null,
            ),
        }).toEqual({
            nativeValue: '3',
            usdValue: '0.5',
            fiatValue: null,
            nativeFiat: null,
        })

        const total = totals.accountValueTotals.get(
            accountValueKey('algorand', 'ADDR2'),
        )
        expect({
            nativeValue: str(total?.nativeValue ?? null),
            usdValue: str(total?.usdValue ?? null),
            fiatValue: str(total?.fiatValue ?? null),
            portfolioUsdValue: str(totals.portfolioUsdValue),
        }).toEqual({
            nativeValue: '3',
            usdValue: null,
            fiatValue: null,
            portfolioUsdValue: null,
        })

        expect({
            nativeAmount: str(summary.nativeAmount),
            portfolioUsdValue: str(summary.portfolioUsdValue),
            portfolioNativeValue: str(summary.portfolioNativeValue),
        }).toEqual({
            nativeAmount: '3',
            portfolioUsdValue: null,
            portfolioNativeValue: '3',
        })
    })
})
