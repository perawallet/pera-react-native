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

// Connectivity can die between a swap's two transaction groups: the first
// lands, the second is rejected by the node. Resumable submission (this
// plan) means that is `partially-submitted`, not `failed` — and confirming
// again re-broadcasts only the group that never landed.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    onTestFinished,
    vi,
} from 'vitest'
import React, { useEffect, useRef } from 'react'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    seedAlgo25Signer,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { waitFor } from '@testing-library/react'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { encodeTransaction } from '@perawallet/wallet-core-blockchain'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-blockchain/test-handlers'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '@modules/swap/hooks/useSwapExecution'

import {
    useSwapResumeStore,
    useSwapStatusReportFlush,
    useSwapStatusReportStore,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'

const SLOW_TEST_TIMEOUT_MS = 30_000
const SWAP_ID = '55555'
const SENDER = REVIEW_SIGNER_ADDRESS

// Fixed per-submit-call ids so a test can assert on the exact txid reported,
// not just the count.
const SUBMIT_TX_IDS = [
    'SWAPPARTIALTXID000000000000000000000000000001',
    'SWAPPARTIALTXID000000000000000000000000000002',
    'SWAPPARTIALTXID000000000000000000000000000003',
]

// Captured from the host so tests can kick off the swap at controlled times.
let executeSwap: ((quote: SwapQuote) => Promise<SwapExecutionOutcome>) | null =
    null

const SwapHost = () => {
    const { execute } = useSwapExecution()
    const { setPreference } = usePreferences()
    // RootComponent mounts this through SwapOverlays; without it the queued
    // status report never leaves the device.
    useSwapStatusReportFlush()
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

const buildQuote = (): SwapQuote =>
    ({
        quoteIdStr: 'quote-partial-submit-1',
        swapperAddress: SENDER,
        assetIn: { assetId: '0' },
        assetOut: { assetId: '31566704' },
        // Two ALGO payment groups (1.5 + 0.5 ALGO) below spend this in
        // total, which validateSwapGroupAgainstQuote allows for.
        amountIn: new Decimal(2_000_000),
        peraFeeAmount: new Decimal(0),
        // Client-stamped freshness marker: execute() refuses a quote
        // without a recent `fetchedAt` as stale before it ever reaches
        // prepare. Stamp it "now" so this exercises the submission path
        // rather than tripping the staleness guard.
        fetchedAt: Date.now(),
    }) as unknown as SwapQuote

// Two single-txn groups (opt-in-shaped first group, swap-shaped second),
// mirroring the multi-group prepare response's real shape. Returns the hit
// counter so a test can assert prepare is never called again on resume.
const mockPrepareWithTwoGroups = (): { prepareHits: number[] } => {
    const first = buildPaymentTransaction({
        sender: SENDER,
        receiver: REVIEW_RECEIVER_ADDRESS,
        amount: 1_500_000n,
    })
    const second = buildPaymentTransaction({
        sender: SENDER,
        receiver: REVIEW_RECEIVER_ADDRESS,
        amount: 500_000n,
    })
    const prepareHits: number[] = []
    server.use(
        http.post('*/v2/dex-swap/prepare-transactions/', () => {
            prepareHits.push(1)
            return HttpResponse.json(
                {
                    transaction_groups: [
                        {
                            purpose: 'opt-in' as const,
                            transaction_group_id: 'group-optin-1',
                            transactions: [
                                encodeToBase64(encodeTransaction(first)),
                            ],
                            signed_transactions: [null],
                        },
                        {
                            purpose: 'swap' as const,
                            transaction_group_id: 'group-swap-1',
                            transactions: [
                                encodeToBase64(encodeTransaction(second)),
                            ],
                            signed_transactions: [null],
                        },
                    ],
                    swap_id: 55_555,
                    swap_id_str: SWAP_ID,
                    swap_version: 'v2',
                },
                { status: 200 },
            )
        }),
    )
    return { prepareHits }
}

// The first `/v2/transactions` POST (the opt-in group) succeeds; the second
// (the swap group) is rejected by the node with a 400 carrying an algod
// error body — a deterministic node rejection (`rejected-by-node`), not a
// timing-dependent `unknown-outcome`. `algodShouldRejectSecond` lets a test
// flip the node back to healthy without re-registering the whole handler.
const spyOnSubmissionAndStatus = () => {
    const algodBodies: Uint8Array[] = []
    const statusPayloads: Array<Record<string, unknown>> = []
    let algodShouldRejectSecond = true

    server.use(
        http.post('*/v2/transactions', async ({ request }) => {
            const body = new Uint8Array(await request.arrayBuffer())
            algodBodies.push(body)
            if (algodBodies.length === 2 && algodShouldRejectSecond) {
                // A parseable node verdict (below_min_balance), not one of
                // the no-verdict codes — classifies deterministically as
                // `rejected-by-node`, unlike a raw network failure whose
                // classification depends on timing.
                return HttpResponse.json(
                    {
                        message: `account ${SENDER} balance 400000 below min 500000`,
                    },
                    { status: 400 },
                )
            }
            return HttpResponse.json(
                { txId: SUBMIT_TX_IDS[algodBodies.length - 1] },
                { status: 200 },
            )
        }),
        http.get('*/v2/transactions/pending/*', () =>
            HttpResponse.json(
                { 'confirmed-round': 101, 'pool-error': '' },
                { status: 200 },
            ),
        ),
        http.get('*/v2/status', () =>
            HttpResponse.json({ 'last-round': 100 }, { status: 200 }),
        ),
        http.patch(`*/v2/dex-swap/swaps/${SWAP_ID}/`, async ({ request }) => {
            const payload = (await request.json()) as Record<string, unknown>
            statusPayloads.push(payload)
            return HttpResponse.json(
                { swap_version: 'v2', ...payload },
                { status: 200 },
            )
        }),
    )
    return {
        algodBodies,
        statusPayloads,
        healAlgod: () => {
            algodShouldRejectSecond = false
        },
    }
}

describe('Flow: Swap submission survives a connectivity drop between groups', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        executeSwap = null
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        // Both stores outlive a render; a record left by an earlier case
        // would otherwise still be there when the next one counts them.
        useSwapStatusReportStore.getState().resetState()
        useSwapResumeStore.getState().resetState()
        await seedAlgo25Signer()
        // execute() runs a balance preflight against algod before prepare;
        // fund the sender well past the 2-ALGO quote plus fees and the
        // receive asset's opt-in MBR.
        server.use(
            mockAlgodAccountInformation({
                address: SENDER,
                response: { amount: 10_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it(
        "Given algod accepts the first group and rejects the second, when the swap executes, then it resolves partially-submitted and reports in_progress with the first group's txid",
        async () => {
            mockPrepareWithTwoGroups()
            const { algodBodies, statusPayloads } = spyOnSubmissionAndStatus()

            renderWithNavigation(SwapHost, 'SwapPartialSubmitHost')
            await waitFor(() => expect(executeSwap).not.toBeNull())

            const outcome = await executeSwap!(buildQuote())

            expect(outcome.kind).toBe('partially-submitted')
            expect(algodBodies).toHaveLength(2)

            // The report the backend receives must carry the landed group's
            // txid as progress — not a `failed` report with an empty list,
            // which is what shipped before resumable submission.
            await waitFor(() => expect(statusPayloads).toHaveLength(1))
            expect(statusPayloads[0].status).toBe('in_progress')
            expect(statusPayloads[0].submitted_transaction_ids).toEqual([
                SUBMIT_TX_IDS[0],
            ])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a swap left partially submitted, when the user confirms again with algod healthy, then only the un-landed group is resubmitted and the swap succeeds',
        async () => {
            const { prepareHits } = mockPrepareWithTwoGroups()
            const { algodBodies, healAlgod } = spyOnSubmissionAndStatus()
            // Resuming reuses the bytes signed on the first attempt — the
            // resume branch must return into submitPhase before signing is
            // ever reached again.
            const signSpy = vi.spyOn(getProvider().key.store, 'sign')
            onTestFinished(() => signSpy.mockRestore())

            renderWithNavigation(SwapHost, 'SwapPartialSubmitHost')
            await waitFor(() => expect(executeSwap).not.toBeNull())

            const quote = buildQuote()
            const firstOutcome = await executeSwap!(quote)
            expect(firstOutcome.kind).toBe('partially-submitted')
            expect(algodBodies).toHaveLength(2)
            expect(prepareHits).toHaveLength(1)
            const signCallsAfterFirstAttempt = signSpy.mock.calls.length

            healAlgod()
            const secondOutcome = await executeSwap!(quote)

            expect(secondOutcome).toEqual({ kind: 'success' })
            // Exactly one further submit — the un-landed second group. The
            // first group's bytes are not replayed.
            expect(algodBodies).toHaveLength(3)
            // Resuming skips prepare entirely: the groups are already
            // signed from the first attempt.
            expect(prepareHits).toHaveLength(1)
            // No re-signing on resume: the key store is never touched again.
            expect(signSpy.mock.calls.length).toBe(signCallsAfterFirstAttempt)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
