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

// The NFT gallery filter at the hook boundary: balances + asset metadata out of
// the DB, filtered through `isCollectible` into `useAccountNfts.collectibles`.
//
// AccountNfts delegates its filtering to this hook, so locking the hook
// contract covers the gallery without depending on FlatList/SVG paths that
// don't render usefully under jsdom. `view-nft.test.tsx` covers the detail
// screen.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Notifier } from 'react-native-notifier'

import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    insertAssetHolding,
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCollectiblePreferencesStore } from '@perawallet/wallet-core-assets'
import { Networks } from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useAccountNfts } from '@modules/accounts/components/AccountNfts/useAccountNfts'

import {
    NFT_TEST_ASSET,
    NFT_TEST_ASSET_ID,
    NFT_TEST_ASSET_2,
    NFT_TEST_ASSET_2_ID,
    NFT_TEST_ASSET_3,
    NFT_TEST_ASSET_3_ID,
    USDC_TEST_ASSET,
    USDC_TEST_ASSET_ID,
} from './__fixtures__/assets'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const HOLDER: WalletAccount = {
    id: 'gallery-holder',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'gallery-holder-key',
    name: 'Gallery Holder',
}

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: NFT gallery hook (useAccountNfts)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        // The sort-mode test mutates the module-global preferences store.
        useCollectiblePreferencesStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        // Seed both an NFT and a fungible token in the asset metadata
        // table — the gallery hook joins these in via useAssetsQuery
        // and uses each row's peraMetadata.type to decide which list
        // they belong in.
        await seedAssets([NFT_TEST_ASSET, USDC_TEST_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([HOLDER])
        useAccountsStore.getState().setSelectedAccountAddress(HOLDER.address)
        vi.mocked(Notifier.showNotification).mockClear()

        await upsertAccountBalance({
            accountAddress: HOLDER.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })

        // Account holds 1 NFT + 50 USDC. Both have non-zero balances so
        // the showOptedIn preference doesn't enter into filtering — the
        // assertion is purely "collectible vs fungible".
        await insertAssetHolding({
            accountAddress: HOLDER.address,
            assetId: NFT_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '1',
        })
        await insertAssetHolding({
            accountAddress: HOLDER.address,
            assetId: USDC_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '50000000',
        })
    })

    it(
        'Given an account holds one NFT and one fungible asset, when useAccountNfts resolves, then collectibles contains only the NFT and collectibleCount is 1',
        async () => {
            const { result } = renderHook(() => useAccountNfts(), {
                wrapper: buildWrapper(),
            })

            // hasAccount flips true synchronously from the store.
            expect(result.current.hasAccount).toBe(true)

            // The hook chains two queries (balances → assets); wait for
            // both to settle before asserting the filter result.
            await waitFor(
                () => {
                    expect(result.current.isPending).toBe(false)
                    expect(result.current.collectibleCount).toBe(1)
                },
                { timeout: 5000 },
            )

            // Only the NFT survives the isCollectible filter — the
            // USDC-like asset (peraMetadata.type === 'standard_asset')
            // is excluded.
            const ids = result.current.collectibles.map(c => c.assetId)
            expect(ids).toEqual([NFT_TEST_ASSET_ID])
            expect(ids).not.toContain(USDC_TEST_ASSET_ID)

            // The row carries the asset columns the gallery renders from,
            // unparsed; check they round-trip through the DB layer.
            const nft = result.current.collectibles[0]
            expect(nft.name).toBe(NFT_TEST_ASSET.name)
            expect(nft.decimals).toBe(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given two held NFTs with opt-in rounds served by the indexer, when the sort mode is recentlyAdded, then the most recently opted-in NFT comes first',
        async () => {
            await seedAssets([NFT_TEST_ASSET_2], 'mainnet')
            await insertAssetHolding({
                accountAddress: HOLDER.address,
                assetId: NFT_TEST_ASSET_2_ID,
                network: 'mainnet',
                amount: '1',
            })

            // The lower-id NFT gets the HIGHER round: the expected order can
            // only come from opt-in data, not from the asset-id (newestFirst)
            // or title (titleAsc) orderings, which both put the other one
            // first.
            server.use(
                http.get(
                    `${getNetworkConfig(Networks.mainnet).indexerUrl}/v2/accounts/:address/assets`,
                    () =>
                        HttpResponse.json({
                            'current-round': 30_000,
                            assets: [
                                {
                                    'asset-id': Number(NFT_TEST_ASSET_ID),
                                    amount: 1,
                                    'is-frozen': false,
                                    deleted: false,
                                    'opted-in-at-round': 20_000,
                                },
                                {
                                    'asset-id': Number(NFT_TEST_ASSET_2_ID),
                                    amount: 1,
                                    'is-frozen': false,
                                    deleted: false,
                                    'opted-in-at-round': 10_000,
                                },
                            ],
                        }),
                ),
            )

            useCollectiblePreferencesStore
                .getState()
                .setCollectibleSortMode('recentlyAdded')

            const { result } = renderHook(() => useAccountNfts(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => {
                    expect(result.current.collectibleCount).toBe(2)
                    expect(
                        result.current.collectibles.map(c => c.assetId),
                    ).toEqual([NFT_TEST_ASSET_ID, NFT_TEST_ASSET_2_ID])
                },
                { timeout: 5000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a just-opted-in NFT the indexer does not know yet, when the sort mode is recentlyAdded, then that NFT leads and the known ones follow in opt-in order',
        async () => {
            await seedAssets([NFT_TEST_ASSET_2, NFT_TEST_ASSET_3], 'mainnet')
            for (const assetId of [NFT_TEST_ASSET_2_ID, NFT_TEST_ASSET_3_ID]) {
                await insertAssetHolding({
                    accountAddress: HOLDER.address,
                    assetId,
                    network: 'mainnet',
                    amount: '1',
                })
            }

            // QA scenario: asset 3 is held (SQLite mirrors algod)
            // but the lagging indexer omits it. Expected order is unique to
            // opt-in data: raw id order gives [3, 2, 1], titles give
            // [2, 3, 1], the old sink behavior gave [1, 2, 3].
            server.use(
                http.get(
                    `${getNetworkConfig(Networks.mainnet).indexerUrl}/v2/accounts/:address/assets`,
                    () =>
                        HttpResponse.json({
                            'current-round': 30_000,
                            assets: [
                                {
                                    'asset-id': Number(NFT_TEST_ASSET_ID),
                                    amount: 1,
                                    'is-frozen': false,
                                    deleted: false,
                                    'opted-in-at-round': 20_000,
                                },
                                {
                                    'asset-id': Number(NFT_TEST_ASSET_2_ID),
                                    amount: 1,
                                    'is-frozen': false,
                                    deleted: false,
                                    'opted-in-at-round': 10_000,
                                },
                            ],
                        }),
                ),
            )

            useCollectiblePreferencesStore
                .getState()
                .setCollectibleSortMode('recentlyAdded')

            const { result } = renderHook(() => useAccountNfts(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => {
                    expect(result.current.collectibleCount).toBe(3)
                    expect(
                        result.current.collectibles.map(c => c.assetId),
                    ).toEqual([
                        NFT_TEST_ASSET_3_ID,
                        NFT_TEST_ASSET_ID,
                        NFT_TEST_ASSET_2_ID,
                    ])
                },
                { timeout: 5000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the gallery hook has resolved with one NFT, when the search filter is set to a non-matching string, then collectibles becomes empty',
        async () => {
            const { result } = renderHook(() => useAccountNfts(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => {
                    expect(result.current.collectibleCount).toBe(1)
                },
                { timeout: 5000 },
            )

            // Setting the filter to a string that doesn't appear in the
            // NFT's name, unitName, or collection.name drops it from
            // the result. The hook debounces the filter — wait for the
            // debounce window before asserting.
            act(() => {
                result.current.setSearchFilter('zzzz-no-match')
            })

            await waitFor(
                () => {
                    expect(result.current.debouncedSearchFilter).toBe(
                        'zzzz-no-match',
                    )
                    expect(result.current.collectibleCount).toBe(0)
                },
                { timeout: 5000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
