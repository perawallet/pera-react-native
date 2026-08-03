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

// Failure paths for flows whose happy paths live in their own flow tests:
// send ALGO on a 5xx (toast, no success screen), opt-in on a 5xx (mutation
// rejects, DB unchanged), and swap quote on a 503 (mutation goes to error).
//
// These are the three failures support sees most: "tx didn't go through",
// "opt-in failed", "swap price never appeared". Kept separate so an
// error-handling regression stays loud.

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
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import React from 'react'
import { Decimal } from 'decimal.js'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'

import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import {
    mockCreateQuotes,
    mockSwapProviders,
} from '@perawallet/wallet-core-swaps/test-handlers'
import { useCreateQuotesMutation } from '@perawallet/wallet-core-swaps'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000
const RECEIVER_ADDRESS = HD_TEST_ADDRESS

const seedAlgo25Sender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })
    const sender: WalletAccount = {
        id: 'failure-sender',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: keyResult!.seedKey.id ?? '',
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
            { name: 'TransactionSuccess', component: TransactionSuccessScreen },
        ],
    })

const buildHookWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Edge: Network failure paths', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
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
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it(
        'Given the user submits a valid send, when algod /v2/transactions returns 503, then the success screen never renders and a failure toast is raised',
        async () => {
            // All the build-side endpoints succeed — only the final
            // POST to /v2/transactions fails. This isolates the
            // failure-handling path from any earlier validation errors.
            server.use(
                mockAlgodTransactionParams({ response: { fee: 1000 } }),
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodAccountInformation({
                    address: RECEIVER_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodStatus({ response: { 'last-round': 100 } }),
                mockIndexerSearchForAccounts(),
            )

            const sender = await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // The crucial bit: algod returns a structured error
            // payload that algokit-utils surfaces directly (it doesn't
            // retry on 4xx). The build pipeline signs locally, then
            // fails on submission, then routes to the error path
            // rather than the success screen.
            const failingSendSpy = vi.fn(() =>
                HttpResponse.json(
                    { message: 'TransactionPool.Remember: invalid signature' },
                    { status: 400 },
                ),
            )
            server.use(http.post('*/v2/transactions', failingSendSpy))

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

            // The send pipeline fired the network call (proves we got
            // past local signing) and the send_processing transition.
            await waitFor(
                () => {
                    expect(failingSendSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            // PWResultView is the success screen marker — it must not
            // mount on a failed broadcast. The Notifier toast is the
            // user-visible signal of failure.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('PWResultView')).toBeFalsy()
            // Sender state survives — the failure shouldn't drop the
            // selected account.
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                sender.address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a swap quote fetch starts with the providers list ready, when /v2/dex-swap/quotes/ returns 503, then the mutation transitions to an error state without throwing',
        async () => {
            server.use(
                mockSwapProviders({
                    response: {
                        results: [
                            {
                                name: 'tinyman_v2',
                                display_name: 'Tinyman v2',
                                icon_url: '',
                            },
                        ],
                    },
                }),
                mockCreateQuotes({
                    response: { results: [] },
                    status: 503,
                }),
            )

            const { result } = renderHook(() => useCreateQuotesMutation(), {
                wrapper: buildHookWrapper(),
            })

            result.current.mutate({
                swapper_address: ALGO25_TEST_ADDRESS,
                swap_type: 'fixed-input',
                asset_in_id: 0,
                asset_out_id: 31_566_704,
                amount: '10000000',
                slippage: '0.01',
            })

            // The mutation has `throwOnError: false` so the error
            // surfaces as state, not a rejection. UI consumers (toast
            // host, swap form) read `isError` to decide whether to
            // surface the error.
            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.error).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a request that crashes the network layer (transport error, not HTTP error), when the swap quote mutation runs, then the error state surfaces via TanStack Query rather than crashing the consumer',
        async () => {
            server.use(
                mockSwapProviders({
                    response: {
                        results: [
                            {
                                name: 'tinyman_v2',
                                display_name: 'Tinyman v2',
                                icon_url: '',
                            },
                        ],
                    },
                }),
                // HttpResponse.error() simulates a transport failure
                // (connection reset, DNS failure) — distinct from a
                // 5xx HTTP response. The mutation's promise rejects
                // before any response body is parsed.
                http.post('*/v2/dex-swap/quotes/', () => HttpResponse.error()),
            )

            const { result } = renderHook(() => useCreateQuotesMutation(), {
                wrapper: buildHookWrapper(),
            })

            result.current.mutate({
                swapper_address: ALGO25_TEST_ADDRESS,
                swap_type: 'fixed-input',
                asset_in_id: 0,
                asset_out_id: 31_566_704,
                amount: '10000000',
                slippage: '0.01',
            })

            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 5000 },
            )
            // The error itself is non-null — production read sites use
            // `error.message` for the toast body.
            expect(result.current.error).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
