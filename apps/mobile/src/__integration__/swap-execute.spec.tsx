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
// The router order a swap runs on: place the order for the quote, sign and
// submit its steps, and report the outcome back (`sent` with the transaction
// ids, or `cancelled` when nothing was broadcast).

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import React, { useEffect, useRef } from 'react'
import { renderHook } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { createQueryClientWrapper } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    seedAlgo25Signer,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    useAccountChainStateStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { NoConnectionError } from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    useCreateSwapOrderMutation,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { mockCreateSwapOrder } from '@perawallet/wallet-core-swaps/test-handlers'
import { SigningOverlays } from '@modules/signing/shell'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '@modules/swap/hooks/useSwapExecution'

import { addressOf } from './__fixtures__/accounts'
import {
    ALGORAND_MAINNET_CAIP2,
    buildRouterSwapQuote,
    mockSwapOrderWithPayment,
    spyOnSwapSubmissionAndReports,
} from './__fixtures__/swapRouter'

let executeSwap: ((quote: SwapQuote) => Promise<SwapExecutionOutcome>) | null =
    null

const SwapHost = () => {
    const { execute } = useSwapExecution()
    const { setPreference } = usePreferences()
    const prepared = useRef(false)
    useEffect(() => {
        if (!prepared.current) {
            prepared.current = true
            setPreference('hasSeenTransactionRequestFAQ', true)
        }
        executeSwap = execute
    }, [execute, setPreference])
    return <SigningOverlays />
}

const startSwapHost = async (): Promise<string> => {
    const signer = await seedAlgo25Signer()
    useAccountsStore.getState().setAccounts([signer])
    useAccountsStore.getState().setSelectedAccountId(signer.id)
    renderWithNavigation(SwapHost, 'SwapExecuteHost')
    await waitFor(() => expect(executeSwap).not.toBeNull())
    return addressOf(signer)
}

describe('Flow: Swap execute (order → sign → submit → report)', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })
    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
    })
    afterEach(() => {
        executeSwap = null
        // Never leak offline state into sibling tests/files.
        onlineManager.setOnline(true)
    })

    const fund = (address: string) =>
        server.use(
            mockAlgodAccountInformation({
                address,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )

    it("Given an order whose step pays exactly the quote's amount, when the swap runs, then it submits and reports the order sent with the transaction and its step's purpose", async () => {
        const sender = await startSwapHost()
        fund(sender)
        mockSwapOrderWithPayment({ sender, receiver: REVIEW_RECEIVER_ADDRESS })
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        const outcome = await executeSwap!(buildRouterSwapQuote(sender))

        expect(outcome).toEqual({ kind: 'success' })
        expect(algodBodies).toHaveLength(1)
        await waitFor(() => expect(reports).toHaveLength(1))
        expect(reports[0]).toEqual({
            status: 'sent',
            transactions: [
                {
                    chain: ALGORAND_MAINNET_CAIP2,
                    tx_hash: expect.any(String),
                    purpose: 'swap',
                },
            ],
        })
    })

    it('Given the router no longer has the quote, when the swap runs, then it resolves as a stale quote and nothing is signed, submitted or reported', async () => {
        const sender = await startSwapHost()
        fund(sender)
        server.use(
            mockCreateSwapOrder({
                response: { error: 'Quote not found', code: 'quote_not_found' },
                status: 404,
            }),
        )
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        const outcome = await executeSwap!(buildRouterSwapQuote(sender))

        expect(outcome).toEqual({ kind: 'stale-quote' })
        expect(algodBodies).toHaveLength(0)
        expect(reports).toHaveLength(0)
    })

    it('Given an order whose step spends more than the app asked to swap, when the swap runs, then it refuses before signing and reports the order cancelled', async () => {
        const sender = await startSwapHost()
        fund(sender)
        // The quote asks for 1 ALGO; the step pays 4.
        mockSwapOrderWithPayment({
            sender,
            receiver: REVIEW_RECEIVER_ADDRESS,
            amount: 4_000_000n,
        })
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()

        const outcome = await executeSwap!(buildRouterSwapQuote(sender))

        expect(outcome).toMatchObject({ kind: 'error', phase: 'prepare' })
        expect(algodBodies).toHaveLength(0)
        await waitFor(() => expect(reports).toEqual([{ status: 'cancelled' }]))
    })

    it('Given the order was attempted offline, when connectivity returns without a fresh user action, then the order is never placed (no auto-resume)', async () => {
        let orderHits = 0
        server.use(
            http.post('*/api/v4/swap/orders/', () => {
                orderHits += 1
                return HttpResponse.json(
                    {
                        order_id: 'o',
                        status: 'pending',
                        expires_at: null,
                        steps: [],
                    },
                    { status: 201 },
                )
            }),
        )
        onlineManager.setOnline(false)

        const { result } = renderHook(() => useCreateSwapOrderMutation(), {
            wrapper: createQueryClientWrapper(),
        })
        result.current.mutate({
            quoteId: 'quote-1',
            scope: { chainId: 'algorand', networkId: 'mainnet' },
        })

        await waitFor(() => expect(result.current.isError).toBe(true), {
            timeout: 5000,
        })
        expect(result.current.error).toBeInstanceOf(NoConnectionError)
        expect(result.current.isPaused).toBe(false)

        onlineManager.setOnline(true)
        await new Promise(resolve => setTimeout(resolve, 100))
        expect(orderHits).toBe(0)
        expect(result.current.isError).toBe(true)
    })
})
