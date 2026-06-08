/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Integration coverage for the swap execution kickoff:
//
//   user has a quote   ─►  usePrepareTransactionsMutation
//                                │
//                                └─► POST /v2/dex-swap/prepare-transactions/
//                                       returns transaction_groups
//                                       (opt-in / swap / fee), each with
//                                       base64-encoded txns to sign,
//                                       plus swap_id_str
//
//   user signs groups  ─►  signing pipeline (covered by send-algo /
//                                send-asa flow tests, and
//                                useSigningRequest unit tests)
//
//   txns submitted     ─►  useUpdateSwapStatusMutation
//                                │
//                                └─► PATCH /v2/dex-swap/swaps/:id/
//                                       wallet reports outcome (success
//                                       or reason for failure) so the
//                                       backend can mark the swap.
//
// This file covers the two wallet ↔ Pera-API boundaries that bookend a
// swap. Actual on-chain msgpack signing of the prepared groups reuses
// the same pipeline as `send-algo.test.tsx` and isn't re-tested here.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
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

describe('Flow: Swap execute (prepare → submit → status)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
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
})
