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

// The two wallet <-> Pera-API boundaries that bookend a swap:
// `usePrepareTransactionsMutation` (POST prepare-transactions, returning the
// opt-in/swap/fee groups plus swap_id_str) and `useUpdateSwapStatusMutation`
// (PATCH the outcome back so the backend can mark the swap).
//
// The signing in between reuses send-algo.test.tsx's pipeline and isn't
// re-tested here.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import {
    mutationDefaults,
    NoConnectionError,
} from '@perawallet/wallet-core-shared'
import {
    mockPrepareTransactions,
    mockUpdateSwapStatus,
} from '@perawallet/wallet-core-swaps/test-handlers'
import {
    usePrepareTransactionsMutation,
    useUpdateSwapStatusMutation,
} from '@perawallet/wallet-core-swaps'

const SLOW_TEST_TIMEOUT_MS = 30_000
const QUOTE_ID = 'quote-tinyman-1'
const SWAP_ID = '12345'

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

// Mirrors the app's real mutation policy (`mutationDefaults`, incl.
// `networkMode: 'always'`) rather than the plain test client. This is required
// to exercise OFF-004 fail-fast: under the default `networkMode: 'online'` an
// offline mutation would PAUSE and auto-resume on reconnect — the exact
// behavior this test proves is gone.
const buildFailFastWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { ...mutationDefaults, retry: false },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: Swap execute (prepare → submit → status)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => {
        server.resetHandlers()
        // Never leak offline state into sibling tests/files.
        onlineManager.setOnline(true)
    })
    afterAll(() => server.close())

    it(
        'Given a quote ID, when the user kicks off swap execution, then prepare-transactions returns the multi-group atomic structure (opt-in + swap) with swap_id and the per-group txn arrays preserved',
        async () => {
            // Two-group response: an opt-in group (one txn) followed by
            // a swap group (two txns — atomic on Algorand). The
            // production signing pipeline iterates groups in order so
            // the user opts in to USDC before the swap that gives them
            // USDC. Asserting both groups round-trip catches a regression
            // where the parser flattens groups or drops the opt-in.
            const response = {
                transaction_groups: [
                    {
                        purpose: 'opt-in' as const,
                        transaction_group_id: 'group-optin-1',
                        transactions: ['BASE64OPTIN'],
                        signed_transactions: [null],
                    },
                    {
                        purpose: 'swap' as const,
                        transaction_group_id: 'group-swap-1',
                        transactions: ['BASE64SWAP1', 'BASE64SWAP2'],
                        signed_transactions: [null, null],
                    },
                ],
                swap_id: 12_345,
                swap_id_str: SWAP_ID,
                swap_version: 'v2',
            }
            server.use(mockPrepareTransactions({ response }))

            const { result } = renderHook(
                () => usePrepareTransactionsMutation(),
                { wrapper: buildWrapper() },
            )

            result.current.mutate({ quote: QUOTE_ID })

            await waitFor(
                () => {
                    expect(result.current.isSuccess).toBe(true)
                },
                { timeout: 5000 },
            )

            const data = result.current.data!
            expect(data.swapIdStr).toBe(SWAP_ID)
            expect(data.transactionGroups).toHaveLength(2)

            // Opt-in group is first — production signs it first so the
            // user can hold the destination asset before the swap clears.
            expect(data.transactionGroups![0].purpose).toBe('opt-in')
            expect(data.transactionGroups![0].transactions).toEqual([
                'BASE64OPTIN',
            ])

            // Swap group has both legs of the atomic exchange. If the
            // schema's `transactions` field were dropped or coerced to
            // a string, this length assertion would fail.
            expect(data.transactionGroups![1].purpose).toBe('swap')
            expect(data.transactionGroups![1].transactions).toEqual([
                'BASE64SWAP1',
                'BASE64SWAP2',
            ])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the backend rejects the prepare request, when the user kicks off swap execution, then the mutation surfaces the error and yields no transaction groups to sign',
        async () => {
            // The Pera API can refuse to prepare a swap (stale quote, slippage
            // re-check, pool liquidity, etc). The endpoint client throws on a
            // non-2xx, and the mutation opts out of `throwOnError` (handled by
            // the caller), so the failure surfaces as `isError` with no data —
            // the signing pipeline is never handed any groups. Use a raw
            // handler (the typed mock factory only emits schema-valid success
            // bodies).
            server.use(
                http.post('*/v2/dex-swap/prepare-transactions/', () =>
                    HttpResponse.json(
                        { message: 'Quote expired' },
                        { status: 400 },
                    ),
                ),
            )

            const { result } = renderHook(
                () => usePrepareTransactionsMutation(),
                { wrapper: buildWrapper() },
            )

            result.current.mutate({ quote: QUOTE_ID })

            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.data).toBeUndefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a successful broadcast, when the wallet reports the swap status, then PATCH /v2/dex-swap/swaps/:id/ is called with the submitted txn IDs and the response surfaces',
        async () => {
            const submittedTxIds = [
                'OPTINTXID000000000000000000000000000000000000000000001',
                'SWAPTXID0000000000000000000000000000000000000000000002',
                'SWAPTXID0000000000000000000000000000000000000000000003',
            ]
            server.use(
                mockUpdateSwapStatus({
                    swapId: SWAP_ID,
                    response: {
                        status: 'completed',
                        submitted_transaction_ids: submittedTxIds,
                        app_version: '7.0.0',
                        platform: 'ios',
                        swap_version: 'v2',
                    },
                }),
            )

            const { result } = renderHook(() => useUpdateSwapStatusMutation(), {
                wrapper: buildWrapper(),
            })

            result.current.mutate({
                swapId: SWAP_ID,
                data: {
                    status: 'completed',
                    submitted_transaction_ids: submittedTxIds,
                    app_version: '7.0.0',
                    platform: 'ios',
                    swap_version: 'v2',
                },
            })

            await waitFor(
                () => {
                    expect(result.current.isSuccess).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.data?.status).toBe('completed')
            expect(result.current.data?.submittedTransactionIds).toEqual(
                submittedTxIds,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user cancels mid-flow, when the wallet reports the swap status, then the failure reason propagates back through the response',
        async () => {
            server.use(
                mockUpdateSwapStatus({
                    swapId: SWAP_ID,
                    response: {
                        status: 'failed',
                        reason: 'user_cancelled',
                        swap_version: 'v2',
                    },
                }),
            )

            const { result } = renderHook(() => useUpdateSwapStatusMutation(), {
                wrapper: buildWrapper(),
            })

            result.current.mutate({
                swapId: SWAP_ID,
                data: {
                    status: 'failed',
                    reason: 'user_cancelled',
                    swap_version: 'v2',
                },
            })

            await waitFor(
                () => {
                    expect(result.current.isSuccess).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.data?.status).toBe('failed')
            expect(result.current.data?.reason).toBe('user_cancelled')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the prepare was attempted offline, when connectivity returns without a fresh user action, then the prepare transport is never called (no auto-resume)',
        async () => {
            // AC: offline-attempted mutations do not auto-fire on reconnect.
            // Count real hits to the prepare endpoint. `assertOnline()` rejects
            // before any transport, so an offline attempt must leave this at 0,
            // and it must STAY 0 after reconnect since no code re-triggers it.
            let prepareHits = 0
            server.use(
                http.post('*/v2/dex-swap/prepare-transactions/', () => {
                    prepareHits += 1
                    return HttpResponse.json(
                        {
                            transaction_groups: [
                                {
                                    purpose: 'swap' as const,
                                    transaction_group_id: 'group-swap-1',
                                    transactions: ['BASE64SWAP1'],
                                    signed_transactions: [null],
                                },
                            ],
                            swap_id: 12_345,
                            swap_id_str: SWAP_ID,
                            swap_version: 'v2',
                        },
                        { status: 200 },
                    )
                }),
            )

            onlineManager.setOnline(false)

            const { result } = renderHook(
                () => usePrepareTransactionsMutation(),
                { wrapper: buildFailFastWrapper() },
            )

            // User kicks off prepare while offline: it fails fast (rejects)
            // rather than pausing. The transport is never reached.
            result.current.mutate({ quote: QUOTE_ID })

            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.error).toBeInstanceOf(NoConnectionError)
            // Did NOT pause — a paused mutation is what auto-resumes on
            // reconnect, which the policy forbids.
            expect(result.current.isPaused).toBe(false)
            expect(prepareHits).toBe(0)

            // Simulate reconnect WITHOUT any new user action.
            onlineManager.setOnline(true)

            // Give any (forbidden) auto-resume a chance to fire, then confirm
            // the transport was still never called.
            await new Promise(resolve => setTimeout(resolve, 100))
            expect(prepareHits).toBe(0)
            expect(result.current.isError).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
