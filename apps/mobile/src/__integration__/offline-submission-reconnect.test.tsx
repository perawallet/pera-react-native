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

// PERA-4588 AC3 — kill-after-submit reconnect. The real submit chokepoint
// writes the ledger row before the algod POST; a relaunch offline surfaces it
// as a "Pending — verifying" history row; a relaunch online reconciles it to
// confirmed and the synced transaction appears exactly once.

import { type ReactNode } from 'react'

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    getAlgorandClient,
    useNetworkStore,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodPendingTransaction,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import {
    fetchAndPersistTransactions,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import {
    mockTransactionHistory,
    type MockTransactionHistoryParams,
} from '@perawallet/wallet-core-transactions/test-handlers'
import {
    getOpenSubmissionAttempts,
    reconcileOpenSubmissions,
    submitAndAutoRefresh,
    useLocalKeyTransactionSigner,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'

import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { http, HttpResponse, server } from '@test-utils/msw-server'
import {
    createTestQueryClient,
    render,
    renderHook,
    screen,
    waitFor,
} from '@test-utils/render'
import {
    buildPaymentTransaction,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'

const SLOW_TEST_TIMEOUT_MS = 30_000
const NETWORK = 'mainnet'
const CONFIRMED_ROUND = 1000

const renderHistoryQuery = (accountAddress: string) => {
    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return renderHook(
        () => useTransactionHistoryQuery({ accountAddress, network: NETWORK }),
        { wrapper },
    )
}

const committedHistoryResponse = (
    txid: string,
    accountAddress: string,
): MockTransactionHistoryParams['response'] => ({
    current_round: CONFIRMED_ROUND,
    next: null,
    previous: null,
    results: [
        {
            id: txid,
            tx_type: 'pay',
            sender: accountAddress,
            receiver: REVIEW_RECEIVER_ADDRESS,
            confirmed_round: CONFIRMED_ROUND,
            round_time: Math.floor(Date.now() / 1000),
            fee: '1000',
            amount: '1000000',
        },
    ],
})

describe('Flow: offline submission reconnect', () => {
    let onlineBeforeTest: boolean

    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })

    beforeEach(async () => {
        onlineBeforeTest = onlineManager.isOnline()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useNetworkStore.getState().setNetwork('mainnet')
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockAlgodPendingTransaction(),
        )
    })

    afterEach(() => {
        onlineManager.setOnline(onlineBeforeTest)
        server.resetHandlers()
    })

    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    it(
        'Given a signed group accepted before a kill, when the app relaunches offline and then online, then the open row is reconciled to confirmed and the transaction appears in history exactly once',
        async () => {
            // Submit through the real chokepoint; the baseline 404 pending
            // lookup makes the fire-and-forget confirmation wait fail and leave
            // the ledger row open.
            const account = await seedAlgo25Signer()
            const unsignedTxn = buildPaymentTransaction()
            const { result: signer } = renderHook(() =>
                useLocalKeyTransactionSigner(),
            )
            const { result: encoder } = renderHook(() =>
                useTransactionEncoder(),
            )
            const signedTxns = await signer.current.signTransactions(
                [unsignedTxn],
                [0],
                account,
            )
            const algokit = getAlgorandClient(NETWORK)

            const txIds = await submitAndAutoRefresh(
                algokit,
                encoder.current.encodeSignedTransactions,
                signedTxns,
            )
            expect(txIds).toHaveLength(1)
            // The ledger row records the locally-derived txid, while algod's
            // mocked POST echoes its own fixed txId — assert against the former.
            const txid = signedTxns[0]!.txn.txID()

            await waitFor(async () => {
                const open = await getOpenSubmissionAttempts({
                    network: NETWORK,
                })
                expect(open).toHaveLength(1)
                expect(open[0]!.txIds).toContain(txid)
                expect(open[0]!.status).toBe('submitted')
            })

            // Relaunch offline: the pending entry and its badge are observable
            // even though nothing has been persisted as a sign request.
            onlineManager.setOnline(false)

            const history = renderHistoryQuery(account.address)
            await waitFor(() => {
                expect(
                    history.result.current.transactions.length,
                ).toBeGreaterThan(0)
            })
            const firstHistoryItem = history.result.current.transactions[0]!
            expect(firstHistoryItem.id).toBe(txid)
            expect(firstHistoryItem.confirmedRound).toBe(0)

            // The badge query is a pure DB read pinned to networkMode 'always'
            // in source; mirror that here so the badge is observable offline.
            const offlineBadgeClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false, gcTime: 0, networkMode: 'always' },
                    mutations: { retry: false },
                },
            })
            render(<TransactionListItem transaction={firstHistoryItem} />, {
                queryClient: offlineBadgeClient,
            })
            await waitFor(() => {
                // The integration harness leaves i18n uninitialised, so `t`
                // returns the key rather than the English translation.
                expect(
                    screen.getByText('transactions.common.pending_verifying'),
                ).toBeTruthy()
            })

            const signingClient = createTestQueryClient()
            const { result: signingRequest } = renderHook(
                () => useSigningRequest(),
                {
                    wrapper: ({ children }) => (
                        <QueryClientProvider client={signingClient}>
                            {children}
                        </QueryClientProvider>
                    ),
                },
            )
            expect(signingRequest.current.pendingSignRequests).toHaveLength(0)

            // Relaunch online and reconcile the open row to confirmed.
            onlineManager.setOnline(true)
            server.use(
                mockAlgodPendingTransaction({
                    response: { 'confirmed-round': CONFIRMED_ROUND },
                }),
                // The reconciler's algod probe reads both wire forms, so the
                // committed response settles the row directly; the indexer
                // fallback (covered by unit tests) is not exercised here.
                http.get('*/v2/transactions/:txId', ({ params }) =>
                    HttpResponse.json({
                        'current-round': CONFIRMED_ROUND,
                        transaction: {
                            id: String(params.txId),
                            sender: account.address,
                            fee: 1000,
                            'first-valid': 1000,
                            'last-valid': 2000,
                            'tx-type': 'pay',
                            'confirmed-round': CONFIRMED_ROUND,
                            'round-time': Math.floor(Date.now() / 1000),
                        },
                    }),
                ),
                mockTransactionHistory({
                    accountAddress: account.address,
                    response: { results: [], current_round: CONFIRMED_ROUND },
                }),
            )

            const summary = await reconcileOpenSubmissions()
            expect(summary).toEqual({ probed: 1, confirmed: 1, failed: 0 })

            await waitFor(async () => {
                const open = await getOpenSubmissionAttempts({
                    network: NETWORK,
                })
                expect(open).toHaveLength(0)
            })

            const settledHistory = renderHistoryQuery(account.address)
            await waitFor(() => {
                expect(settledHistory.result.current.isFetched).toBe(true)
            })
            expect(
                settledHistory.result.current.transactions.some(
                    tx => tx.id === txid && tx.confirmedRound === 0,
                ),
            ).toBe(false)

            // Persist the committed transaction through the real sync path and
            // confirm it renders exactly once (the pending row is gone).
            server.use(
                mockTransactionHistory({
                    accountAddress: account.address,
                    response: committedHistoryResponse(txid, account.address),
                }),
            )

            await fetchAndPersistTransactions(account.address, NETWORK)

            const syncedHistory = renderHistoryQuery(account.address)
            await waitFor(() => {
                const matches =
                    syncedHistory.result.current.transactions.filter(
                        tx => tx.id === txid,
                    )
                expect(matches).toHaveLength(1)
                expect(matches[0]!.confirmedRound).toBe(CONFIRMED_ROUND)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
