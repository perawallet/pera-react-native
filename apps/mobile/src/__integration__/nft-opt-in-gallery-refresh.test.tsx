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

// QA follow-up: the NFT gallery must reflect a fresh opt-in in
// EVERY sort mode, purely from the opt-in mutation's own writes and
// invalidation. The gallery queries cache with staleTime: Infinity, so sort
// caches warmed before the opt-in keep serving the pre-opt-in list unless
// the mutation invalidates them — the background post-confirmation refresh
// (which cannot run here, and can fail on-device) must not be load-bearing.

import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'
import { Decimal } from 'decimal.js'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
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
import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
} from '@perawallet/wallet-core-assets'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { Networks } from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAccountNfts } from '@modules/accounts/components/AccountNfts/useAccountNfts'

import {
    NFT_TEST_ASSET,
    NFT_TEST_ASSET_ID,
    NFT_TEST_ASSET_2,
    NFT_TEST_ASSET_2_ID,
    NFT_TEST_ASSET_3,
    NFT_TEST_ASSET_3_ID,
} from './__fixtures__/assets'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// Gallery + opt-in in one host so both share the provider tree's query
// client, mirroring the production layout (gallery mounted while the
// add-asset sheet opts in). State is surfaced through a text node because
// the FlatList itself doesn't render usefully under jsdom.
const GalleryOptInHost = ({
    sender,
    assetId,
}: {
    sender: WalletAccount
    assetId: string
}) => {
    const { collectibles, isPending, sortMode, setSortMode } = useAccountNfts()
    const { optIn } = useAssetOptInMutation()
    const { request } = useBottomSheet()

    useEffect(() => {
        void request<'confirm'>({
            contents: (
                <OptInConfirmationContent
                    assetId={assetId}
                    accountAddress={sender.address}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        }).then(result => {
            if (result !== 'confirm') return
            optIn({
                sender: sender.address,
                assetId: BigInt(assetId),
            }).catch(() => {})
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <>
            <Text testID='gallery-state'>
                {`${sortMode}|${isPending ? 'pending' : 'settled'}|${collectibles
                    .map(c => c.assetId)
                    .join(',')}`}
            </Text>
            <Pressable
                testID='sort-title'
                onPress={() => setSortMode('titleAsc')}
            />
            <Pressable
                testID='sort-recent'
                onPress={() => setSortMode('recentlyAdded')}
            />
        </>
    )
}

const galleryState = () => screen.getByTestId('gallery-state').textContent

const expectGalleryState = async (
    mode: CollectibleSortMode,
    assetIds: string[],
) => {
    await waitFor(
        () => {
            expect(galleryState()).toBe(`${mode}|settled|${assetIds.join(',')}`)
        },
        { timeout: 5000 },
    )
}

describe('Flow: NFT gallery reflects a fresh opt-in across sort modes', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useCollectiblePreferencesStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    let sender: WalletAccount

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        // NFT 3's metadata is seeded (the add-asset search has shown it) but
        // the account does NOT hold it yet — it's the opt-in target.
        await seedAssets(
            [NFT_TEST_ASSET, NFT_TEST_ASSET_2, NFT_TEST_ASSET_3],
            'mainnet',
        )

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Notifier.showNotification).mockClear()

        const { result: kms } = renderHook(() => useKMS())
        let key: Algo25KeyResult | null = null
        await waitFor(async () => {
            key = await kms.current.createAlgo25Key({
                mnemonic: ALGO25_TEST_MNEMONIC,
            })
            expect(key).not.toBeNull()
        })
        sender = {
            id: 'sender-1',
            type: AccountTypes.algo25,
            address: ALGO25_TEST_ADDRESS,
            keyPairId: key!.seedKey.id ?? '',
            name: 'Sender',
        }
        useAccountsStore.getState().setAccounts([sender])
        useAccountsStore.getState().setSelectedAccountAddress(sender.address)

        await upsertAccountBalance({
            accountAddress: sender.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })
        await insertAssetHolding({
            accountAddress: sender.address,
            assetId: NFT_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '1',
        })
        await insertAssetHolding({
            accountAddress: sender.address,
            assetId: NFT_TEST_ASSET_2_ID,
            network: 'mainnet',
            amount: '1',
        })

        server.use(
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 200_000,
                    assets: [],
                },
            }),
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            // The mutation re-fetches the opted-in asset's metadata from the
            // Pera REST surface; it's already seeded locally, so a no-op
            // response keeps the persist step quiet.
            http.get('*/v1/assets/', () =>
                HttpResponse.json({ results: [], next: null }, { status: 200 }),
            ),
            // Lagging indexer: it does not know the fresh opt-in yet, so the
            // recentlyAdded order must float the roundless asset to the top.
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
    })

    it(
        'Given sort caches warmed before the opt-in, when the user opts in under recentlyAdded and then switches sort modes, then every mode lists the fresh NFT without any background sync',
        async () => {
            useCollectiblePreferencesStore
                .getState()
                .setCollectibleSortMode('titleAsc')

            renderWithNavigation(
                () => (
                    <GalleryOptInHost
                        sender={sender}
                        assetId={NFT_TEST_ASSET_3_ID}
                    />
                ),
                'GalleryOptInHost',
            )

            // Warm the titleAsc cache with the pre-opt-in pair ('Another' <
            // 'Test'), then move to recentlyAdded (QA's starting point) and
            // let it settle.
            await expectGalleryState('titleAsc', [
                NFT_TEST_ASSET_2_ID,
                NFT_TEST_ASSET_ID,
            ])
            fireEvent.click(screen.getByTestId('sort-recent'))
            await expectGalleryState('recentlyAdded', [
                NFT_TEST_ASSET_ID,
                NFT_TEST_ASSET_2_ID,
            ])

            // Approve the opt-in; the real mutation signs, submits, writes
            // the holding + metadata, and must invalidate the gallery reads.
            await waitFor(() => {
                expect(screen.getByTestId('opt_in_confirm')).toBeTruthy()
            })
            fireEvent.click(screen.getByTestId('opt_in_confirm'))

            // Fresh opt-in leads under recentlyAdded (indexer doesn't know
            // its round yet).
            await expectGalleryState('recentlyAdded', [
                NFT_TEST_ASSET_3_ID,
                NFT_TEST_ASSET_ID,
                NFT_TEST_ASSET_2_ID,
            ])

            // QA's failing step: the pre-warmed titleAsc cache must not keep
            // serving the pre-opt-in list ('Another' < 'Middle' < 'Test').
            fireEvent.click(screen.getByTestId('sort-title'))
            await expectGalleryState('titleAsc', [
                NFT_TEST_ASSET_2_ID,
                NFT_TEST_ASSET_3_ID,
                NFT_TEST_ASSET_ID,
            ])
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
