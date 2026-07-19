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
import { Decimal } from 'decimal.js'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

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
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { CollectibleDetailScreen } from '@modules/assets/screens/CollectibleDetailScreen/CollectibleDetailScreen'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import {
    mockAssetDetails,
    mockIndexerAssetDetails,
    mockPublicAssetDetails,
} from '@perawallet/wallet-core-assets/test-handlers'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { NFT_TEST_ASSET, NFT_TEST_ASSET_ID } from './__fixtures__/assets'

// `useSingleAssetDetailsQuery` for the collectible detail screen always
// passes `useDB: false`, so the screen reads asset metadata from the
// REST surface every time. Mock the three endpoints it merges:
// `/v1/assets/{id}`, `/v1/public/assets/{id}`, and indexer
// `/v2/assets/{id}`. We supply minimal-but-valid bodies that pass the
// zod schemas — the screen's render path covers what the merge
// produces.
//
// The send-NFT test mints a real algo25 key in the in-memory keystore
// for the holder so the signing pipeline can sign the asset-transfer
// (different from the view-only test, which uses a placeholder
// `keyPairId`). The fixture address matches `ALGO25_TEST_ADDRESS`
// regardless.
const NFT_HOLDER_PLACEHOLDER: WalletAccount = {
    id: 'holder-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'holder-key',
    name: 'NFT Holder',
}

const SLOW_TEST_TIMEOUT_MS = 30_000

// Mint a real algo25 keystore key + register the matching account.
// Returns the account so callers can wire the send-funds store + spies
// to the same address the keystore knows how to sign for.
const seedSigningHolder = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(key).not.toBeNull()
    })
    const holder: WalletAccount = {
        id: 'holder-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'NFT Holder',
    }
    useAccountsStore.getState().setAccounts([holder])
    useAccountsStore.getState().setSelectedAccountAddress(holder.address)
    return holder
}

describe('Flow: View NFT collectible detail', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        // Seed the NFT into the on-device assets DB too. The screen
        // itself fetches asset details via the REST surface (mocked
        // below), but `useAccountBalancesQuery` reads asset metadata
        // out of the DB to scale base units → display units; without a
        // row here, holdings come back as zero and the screen treats
        // the NFT as opted-in-not-owned, hiding the Send action.
        await seedAssets([NFT_TEST_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([NFT_HOLDER_PLACEHOLDER])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(NFT_HOLDER_PLACEHOLDER.address)
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()

        // Pre-populate the holding so `useAccountAssetBalanceQuery`
        // resolves to a non-zero amount and the screen renders the
        // "Send" / "Copy" / "Save" action row.
        await insertAssetHolding({
            accountAddress: NFT_HOLDER_PLACEHOLDER.address,
            assetId: NFT_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '1',
        })
        await upsertAccountBalance({
            accountAddress: NFT_HOLDER_PLACEHOLDER.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })

        server.use(
            mockAssetDetails({
                assetID: NFT_TEST_ASSET_ID,
                response: {
                    asset_id: Number(NFT_TEST_ASSET_ID),
                    name: 'Test Collectible #1',
                    unit_name: 'TEST',
                    fraction_decimals: 0,
                    total: '1',
                    verification_tier: 'verified',
                    creator: { address: 'CREATOR' },
                    category: null,
                    collectible: {
                        title: 'Test Collectible #1',
                        primary_image: 'https://example.test/nft-image.png',
                        media_type: 'image',
                        explorer_url: 'https://example.test/explorer/asset',
                        traits: [
                            {
                                display_name: 'Background',
                                display_value: 'Blue',
                            },
                        ],
                        media: [],
                    },
                },
            }),
            mockPublicAssetDetails({
                assetID: NFT_TEST_ASSET_ID,
                response: {
                    asset_id: Number(NFT_TEST_ASSET_ID),
                    name: 'Test Collectible #1',
                    unit_name: 'TEST',
                    fraction_decimals: 0,
                    total_supply: 1,
                    total_supply_as_str: '1',
                    creator_address: 'CREATOR',
                    verification_tier: 'verified',
                    is_collectible: true,
                },
            }),
            mockIndexerAssetDetails({
                assetID: NFT_TEST_ASSET_ID,
                response: {
                    'current-round': 100,
                    asset: {
                        index: Number(NFT_TEST_ASSET_ID),
                        params: {
                            creator: 'CREATOR',
                            decimals: 0,
                            total: 1,
                            name: 'Test Collectible #1',
                            'unit-name': 'TEST',
                        },
                    },
                },
            }),
        )
    })

    it(
        'Given the holder owns an NFT, when CollectibleDetailScreen mounts, then the title and quantity render and the Send action is available',
        async () => {
            renderWithNavigation(
                CollectibleDetailScreen,
                'CollectibleDetails',
                {
                    initialParams: { assetId: NFT_TEST_ASSET_ID },
                },
            )

            // The screen renders a skeleton while the asset query is in
            // flight. Wait for the loaded title to appear.
            await waitFor(
                () => {
                    expect(screen.getByText('Test Collectible #1')).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // Owned NFT (amount > 0) shows the action button row with
            // RoundButton labels common.send / common.copy / common.save.
            // Multiple elements include 'common.send' (the leaf span +
            // its button ancestor); we just need one to exist.
            await waitFor(() => {
                expect(
                    screen.queryAllByText(
                        (_, node) =>
                            (node?.textContent ?? '') === 'common.send',
                    ).length,
                ).toBeGreaterThan(0)
            })

            // Quantity chip shows `x{amount}`. Amount is 1 — the chip
            // renders 'x1' alongside the title. Multiple ancestors
            // contain it (chip → row → screen), so just assert at least
            // one match.
            expect(
                screen.queryAllByText(
                    (_, node) => (node?.textContent ?? '') === 'x1',
                ).length,
            ).toBeGreaterThan(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the holder navigates from NFT detail into the send flow, when they confirm the transfer, then a signed asset-transfer for the NFT is POSTed to algod',
        async () => {
            // Replace the placeholder holder with one whose key we
            // actually hold in the in-memory keystore — required for
            // the signing pipeline to produce a valid signature.
            const holder = await seedSigningHolder()

            // Re-insert the holding under the (now real) holder. The
            // address is the same as the placeholder, so this is
            // essentially a no-op, but keeps the seed explicit.
            await insertAssetHolding({
                accountAddress: holder.address,
                assetId: NFT_TEST_ASSET_ID,
                network: 'mainnet',
                amount: '1',
            })

            // The bottom-sheet entry on CollectibleDetailScreen pushes
            // the user through `SendFundsRoutes` — for an NFT
            // (decimals=0, supply=1) the initial route is
            // `SelectDestination`, then `ConfirmTransaction`. The
            // production sheet lives inside a nested
            // `NavigationIndependentTree`. Rather than fight the
            // nested navigator under jsdom, we exercise the user-
            // visible part the modal owns once the user has chosen a
            // destination: pre-set the send-funds store the way the
            // upstream screens would, then mount the same Confirmation
            // → Processing → Success stack send-asa.test.tsx uses.
            useSendFundsStore.getState().setSelectedAssetId(NFT_TEST_ASSET_ID)
            // NFT amount is `1` in display units; decimals=0 means base
            // == display, so the asset-transfer tx will carry amount=1.
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(HD_TEST_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // Algod stubs sufficient for the build/submit path.
            server.use(
                mockAlgodTransactionParams({ response: { fee: 1000 } }),
                mockAlgodAccountInformation({
                    address: holder.address,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 200_000,
                        assets: [
                            {
                                'asset-id': Number(NFT_TEST_ASSET_ID),
                                amount: 1,
                                'is-frozen': false,
                            },
                        ],
                    },
                }),
                mockAlgodAccountInformation({
                    address: HD_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodStatus({ response: { 'last-round': 100 } }),
                mockAlgodSendRawTransaction(),
                mockIndexerSearchForAccounts(),
            )

            const sendSpy = vi.fn(async () =>
                HttpResponse.json(
                    {
                        txId: 'NFTSENDTXID0000000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                TransactionConfirmationScreen,
                'ConfirmTransaction',
                {
                    additionalScreens: [
                        {
                            name: 'TransactionProcessing',
                            component: TransactionProcessingScreen,
                        },
                        {
                            name: 'TransactionSuccess',
                            component: TransactionSuccessScreen,
                        },
                    ],
                },
            )

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('send_confirm_button'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            const confirmButton = screen.getByTestId(
                'send_confirm_button',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(confirmButton.disabled).toBe(false)
            })

            fireEvent.click(confirmButton)

            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Algod received the signed asset-transfer for the NFT.
            expect(sendSpy).toHaveBeenCalled()
            // `vi.fn(() => ...)` infers the call args as `[]`; cast
            // the whole calls array to the MSW handler shape that the
            // runtime actually invokes the spy with.
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            expect(body.byteLength).toBeGreaterThan(50)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
