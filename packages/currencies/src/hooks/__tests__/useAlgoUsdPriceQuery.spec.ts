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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import { upsertAssetPrices } from '@perawallet/wallet-core-assets'
import {
    scopeForLegacyNetwork,
    toScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { useAlgoUsdPriceQuery } from '../useAlgoUsdPriceQuery'

const testDb = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => testDb.current,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const MAINNET = scopeForLegacyNetwork('mainnet')

describe('useAlgoUsdPriceQuery', () => {
    let queryClient: QueryClient
    let db: Database
    let teardown: () => void

    const storePrice = (usdPrice: string, scope = MAINNET) =>
        upsertAssetPrices({
            db,
            prices: [
                { assetId: ALGO_ASSET_ID, usdPrice: new Decimal(usdPrice) },
            ],
            scope,
        })

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        testDb.current = db
        await runMigrations(db, migrations)

        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
    })

    afterEach(() => {
        // onlineManager is a global singleton — restore connectivity so an
        // offline test can't leak into the next one.
        onlineManager.setOnline(true)
        teardown()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it(`returns the price stored under ${toScopeKey(MAINNET)}`, async () => {
        await storePrice('0.15')

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal('0.15'))
    })

    it('does not fetch when disabled', () => {
        const { result } = renderHook(() => useAlgoUsdPriceQuery(false), {
            wrapper,
        })

        expect(result.current.fetchStatus).toBe('idle')
        expect(result.current.data).toBeUndefined()
    })

    it('serves the ALGO price from SQLite while offline', async () => {
        // SQLite is the source of truth; a DB-backed price read must run and
        // resolve even when onlineManager reports offline, instead of pausing
        // its queryFn (TanStack's default networkMode: 'online' behaviour).
        onlineManager.setOnline(false)
        await storePrice('0.15')

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal('0.15'))
    })

    it('returns zero when only another scope has a price', async () => {
        await storePrice('0.15', scopeForLegacyNetwork('testnet'))

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal(0))
    })
})
