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

// PERA-4955: the Pera backend types an asset as a collectible only once its
// crawler has fetched the media, which lands seconds to hours after a mint.
// The app caches that first "standard_asset" answer, so a minted NFT showed
// up as a plain token — and the 7-day asset TTL kept it that way. Viewing the
// account must re-ask while the asset is still newly seen and move it into
// the gallery.

import { Text } from 'react-native'
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
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
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
    useEnsureAccountEnriched,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PeraAssetType,
    useCollectiblePreferencesStore,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { Networks } from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useAccountNfts } from '@modules/accounts/components/AccountNfts/useAccountNfts'

import { NFT_TEST_ASSET, NFT_TEST_ASSET_ID } from './__fixtures__/assets'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The asset as the backend describes it BEFORE its crawler has run: NFT
// shaped, but not yet typed as a collectible.
const UNCLASSIFIED_ASSET: PeraAsset = {
    ...NFT_TEST_ASSET,
    peraMetadata: {
        ...NFT_TEST_ASSET.peraMetadata!,
        type: PeraAssetType.standard_asset,
    },
}

// Same asset once the crawler finishes — this is what the refetch must pick up.
const CLASSIFIED_RESPONSE = {
    results: [
        {
            asset_id: Number(NFT_TEST_ASSET_ID),
            name: NFT_TEST_ASSET.name,
            unit_name: NFT_TEST_ASSET.unitName,
            fraction_decimals: 0,
            total: '1',
            creator: { address: NFT_TEST_ASSET.creator.address },
            url: NFT_TEST_ASSET.url,
            is_deleted: false,
            verification_tier: 'verified',
            // Required by assetResponseSchema (nullable, not optional) — omit
            // it and the response fails validation and the refetch is a no-op.
            category: null,
            type: 'collectible',
            collectible: {
                title: 'Test Collectible #1',
                standard: 'arc3',
                media_type: 'image',
                primary_image: 'https://example.test/nft-image.png',
                explorer_url: 'https://explorer.test/1',
            },
        },
    ],
    next: null,
}

// Gallery mounted alongside the account-view enrichment, as on the real
// account screen. The FlatList doesn't render usefully under jsdom, so the
// gallery contents are surfaced through a text node.
const AccountViewHost = () => {
    useEnsureAccountEnriched(ALGO25_TEST_ADDRESS)
    const { collectibles, isPending } = useAccountNfts()

    return (
        <Text testID='gallery'>
            {`${isPending ? 'pending' : 'settled'}|${collectibles
                .map(c => c.assetId)
                .join(',')}`}
        </Text>
    )
}

const PERA_BACKEND = getNetworkConfig(Networks.mainnet).backendUrl

const HOUR_MS = 60 * 60 * 1000

/**
 * Caches the asset as of `whenMs`. `first_seen_at` and `updated_at` are both
 * stamped from the clock, so seeding twice backdates the first sighting while
 * leaving the row itself freshly fetched — which is also what a real refetch
 * does.
 */
const cacheAssetAt = async (whenMs: number) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(whenMs)
    try {
        await seedAssets([UNCLASSIFIED_ASSET], 'mainnet')
    } finally {
        clock.mockRestore()
    }
}

describe('Flow: an NFT the backend classifies late still reaches the gallery', () => {
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

    const account: WalletAccount = {
        id: 'holder-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: 'holder-key',
        name: 'Holder',
    }

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await upsertAccountBalance({
            accountAddress: account.address,
            network: 'mainnet',
            algoBalance: new Decimal(1_000_000),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 1,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })
        await insertAssetHolding({
            accountAddress: account.address,
            assetId: NFT_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '1',
        })

        useAccountsStore.getState().setAccounts([account])
        useAccountsStore.getState().setSelectedAccountAddress(account.address)

        server.use(
            // The crawler has since finished, so the backend now says
            // collectible. Both the device-scoped and unscoped surfaces.
            http.post('*/v2/assets/', () =>
                HttpResponse.json(CLASSIFIED_RESPONSE, { status: 200 }),
            ),
            http.get('*/v1/assets/', () =>
                HttpResponse.json(CLASSIFIED_RESPONSE, { status: 200 }),
            ),
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
                        ],
                    }),
            ),
            // Enrichment also fans out to prices/account detail; keep those
            // off the real backend without pinning their shapes here.
            http.get(`${PERA_BACKEND}/*`, () =>
                HttpResponse.json({ results: [], next: null }, { status: 200 }),
            ),
            http.post(`${PERA_BACKEND}/*`, () =>
                HttpResponse.json({ results: [], next: null }, { status: 200 }),
            ),
        )
    })

    it('re-asks about a newly seen asset and moves it into the gallery', async () => {
        await cacheAssetAt(Date.now() - HOUR_MS)

        renderWithNavigation(AccountViewHost, 'AccountView')

        await waitFor(
            () => {
                expect(screen.getByTestId('gallery').textContent).toBe(
                    `settled|${NFT_TEST_ASSET_ID}`,
                )
            },
            { timeout: 10_000 },
        )
    }, 20_000)

    it('leaves an asset first seen long ago on the long cache TTL', async () => {
        // The pre-fix behaviour, and what keeps a settled wallet from re-asking
        // about every plain token it holds.
        await cacheAssetAt(Date.now() - 30 * 24 * HOUR_MS)
        // Refetched an hour ago, so the 7-day TTL still counts it as fresh —
        // only the recheck window decides here, and first_seen_at is outside it.
        await cacheAssetAt(Date.now() - HOUR_MS)

        renderWithNavigation(AccountViewHost, 'AccountView')

        await waitFor(() => {
            expect(screen.getByTestId('gallery').textContent).toBe('settled|')
        })
        // Still nothing after the enrichment pass has had time to land.
        await new Promise(resolve => setTimeout(resolve, 500))
        expect(screen.getByTestId('gallery').textContent).toBe('settled|')
    }, 20_000)
})
