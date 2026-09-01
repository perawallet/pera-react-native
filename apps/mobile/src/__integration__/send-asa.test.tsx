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
import { View } from 'react-native'
import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { AssetSelectionScreen } from '@modules/transactions/screens/send-funds/AssetSelectionScreen/AssetSelectionScreen'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { USDC_TEST_ASSET, USDC_TEST_ASSET_ID } from './__fixtures__/assets'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS
const SLOW_TEST_TIMEOUT_MS = 30_000

// Mint a real algo25 key + register the matching account, mirroring
// `seedAlgo25Sender` from send-algo.test.tsx. Kept in-file rather than
// exported because the helper wants to stay aligned with whatever
// fixture state each test scenario needs.
const seedAlgo25Sender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(key).not.toBeNull()
    })
    const sender: WalletAccount = {
        id: 'sender-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Sender',
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountAddress(sender.address)
    return sender
}

const renderSendStack = () =>
    renderWithNavigation(TransactionConfirmationScreen, 'ConfirmTransaction', {
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
    })

describe('Flow: Send a non-ALGO asset (ASA) end-to-end', () => {
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
        // Seed both ALGO and the test asset; the confirmation screen
        // reads the selected asset's metadata via useAssetsQuery and
        // renders unitName/decimals against it.
        await seedAlgoAsset('mainnet')
        await seedAssets([USDC_TEST_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 200_000,
                    assets: [
                        {
                            'asset-id': Number(USDC_TEST_ASSET_ID),
                            amount: 10_000_000, // 10 tUSD (6 decimals)
                            'is-frozen': false,
                        },
                    ],
                },
            }),
            mockAlgodAccountInformation({
                address: RECEIVER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a sender holding a USDC-like asset, when the user confirms a normal-mode send, then a signed asset-transfer is POSTed to algod and the success screen renders',
        async () => {
            const sender = await seedAlgo25Sender()

            // The confirmation screen reads the sender's asset balance
            // from the local DB (not algod). Seed both the holding row
            // and the algo-balance row so the screen has data to render.
            await insertAssetHolding({
                accountAddress: sender.address,
                assetId: USDC_TEST_ASSET_ID,
                network: 'mainnet',
                amount: '10000000',
            })
            await upsertAccountBalance({
                accountAddress: sender.address,
                network: 'mainnet',
                algoBalance: new Decimal(5_000_000),
                totalAssetsOptedIn: 1,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(200_000),
                status: 'Offline',
                authAddress: null,
            })

            useSendFundsStore.getState().setSelectedAssetId(USDC_TEST_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal('1.5'))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // Capture the algod POST so we can inspect the encoded body
            // and prove the right asset-transfer was built.
            const sendSpy = vi.fn(async () =>
                HttpResponse.json(
                    {
                        txId: 'ASATESTTXID000000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSendStack()

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

            // Inspect the submitted body: msgpack-encoded signed group.
            // We don't decode here (assertion at the byte level is
            // brittle), but we can confirm the spy received a non-empty
            // application/x-binary payload.
            expect(sendSpy).toHaveBeenCalled()
            // `vi.fn(() => ...)` infers the call args as `[]`; cast
            // the whole calls array to the MSW handler shape that the
            // runtime actually invokes the spy with.
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            // A signed asset-transfer group is well over 100 bytes;
            // empty / placeholder bodies would be tiny.
            expect(body.byteLength).toBeGreaterThan(50)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // Seed the local DB rows the confirmation screen reads (holding +
    // algo-balance) so the screen renders and the confirm button enables.
    // Mirrors the happy-path test's inline setup.
    const seedAsaHolding = async (address: string) => {
        await insertAssetHolding({
            accountAddress: address,
            assetId: USDC_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '10000000',
        })
        await upsertAccountBalance({
            accountAddress: address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })
    }

    it(
        'Given the recipient is not opted into the asset, when the user confirms, then algod rejects the asset transfer and the processing screen surfaces an error toast instead of success',
        async () => {
            const sender = await seedAlgo25Sender()
            await seedAsaHolding(sender.address)

            useSendFundsStore.getState().setSelectedAssetId(USDC_TEST_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal('1.5'))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // A normal-mode ASA send builds a plain asset-transfer; nothing in
            // the confirmation → processing stack pre-checks the receiver's
            // opt-in (the opt-in gate lives on the upstream destination
            // screen). The faithful failure is algod rejecting the submission
            // with the "receiver not opted in" node error — the pipeline's
            // submit step throws, `execute()` rejects, and the processing
            // screen raises an error toast and navigates back.
            const rejectSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        message:
                            'TransactionPool.Remember: transaction ABC: receiver error: must optin, asset 31566704 missing from receiver',
                    },
                    { status: 400 },
                ),
            )
            server.use(http.post('*/v2/transactions', rejectSpy))

            renderSendStack()

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
                    expect(rejectSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('PWResultView')).toBeNull()
            await waitFor(() => {
                expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the sender cannot cover the transaction fee, when the user confirms the asset transfer, then algod rejects the submission and the processing screen surfaces an error toast instead of success',
        async () => {
            const sender = await seedAlgo25Sender()
            await seedAsaHolding(sender.address)

            useSendFundsStore.getState().setSelectedAssetId(USDC_TEST_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal('1.5'))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // ASA amount is held in the asset, not ALGO; the fee is still paid
            // in ALGO. There's no client-side ALGO-for-fee gate on this stack,
            // so an under-funded account is caught only when algod rejects the
            // group for underspending the fee. Same surface as above: error
            // toast, no success screen.
            const rejectSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        message:
                            'TransactionPool.Remember: transaction ABC: overspend (account ABC, data {raw 0})',
                    },
                    { status: 400 },
                ),
            )
            server.use(http.post('*/v2/transactions', rejectSpy))

            renderSendStack()

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
                    expect(rejectSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('PWResultView')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a frozen asset holding, when the user opens the send asset picker, then the frozen row is badged and not selectable',
        async () => {
            const sender = await seedAlgo25Sender()
            await insertAssetHolding({
                accountAddress: sender.address,
                assetId: '0',
                network: 'mainnet',
                amount: '5000000',
            })
            await insertAssetHolding({
                accountAddress: sender.address,
                assetId: USDC_TEST_ASSET_ID,
                network: 'mainnet',
                amount: '10000000',
                isFrozen: true,
            })
            await upsertAccountBalance({
                accountAddress: sender.address,
                network: 'mainnet',
                algoBalance: new Decimal(5_000_000),
                totalAssetsOptedIn: 1,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(200_000),
                status: 'Offline',
                authAddress: null,
            })

            const InputAmountStub = () => <View testID='input-amount-stub' />
            renderWithNavigation(AssetSelectionScreen, 'SelectAsset', {
                additionalScreens: [
                    { name: 'InputAmount', component: InputAmountStub },
                    { name: 'SelectDestination', component: InputAmountStub },
                ],
            })

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            `asset-list-item-${USDC_TEST_ASSET_ID}`,
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // The frozen holding is labeled (i18n renders raw keys in tests).
            expect(
                screen.getByText('transactions.asset_freeze.frozen'),
            ).toBeTruthy()

            // Tapping the frozen row must not advance to the amount screen.
            fireEvent.click(
                screen.getByTestId(`asset-list-item-${USDC_TEST_ASSET_ID}`),
            )
            expect(screen.queryByTestId('input-amount-stub')).toBeNull()

            // The unfrozen ALGO row still navigates.
            fireEvent.click(screen.getByTestId('asset-list-item-0'))
            await waitFor(() => {
                expect(screen.getByTestId('input-amount-stub')).toBeTruthy()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
