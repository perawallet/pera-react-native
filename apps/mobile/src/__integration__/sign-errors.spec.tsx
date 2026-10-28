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

// Phase 3 — error paths through the review sheet. A non-WalletConnect
// interactive source (webview) renders the inline "signing failed" view when
// the engine errors; WalletConnect routes failures to its own error sheet and
// the request's error callback instead. Covers an analysis-stage rejection
// (round-trip integrity) and a transport-stage failure (delivery callback
// throws), which is retryable and so keeps the review open for another try.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

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
    buildTransactionSignRequest,
    drainPendingSignRequests,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'

describe('Flow: signing error paths', () => {
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
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
        await seedAlgo25Signer()
        drainPendingSignRequests()
    })

    it('shows the signing-failed view when the round-trip integrity check rejects the request', async () => {
        // rawTransactionsBase64 that does not re-encode to the decoded txn
        // trips validateTransactionRoundTrip in the analyzer → the machine
        // fails before reaching the review controls.
        const { request } = buildTransactionSignRequest({
            sourceType: 'webview',
            txs: [buildPaymentTransaction()],
            overrides: {
                chainData: { algorand: { rawTransactionsBase64: ['AQID'] } },
            },
        })

        renderSignReview(request)

        await waitFor(
            () => {
                expect(
                    screen.getByText('signing.signing_failed.title'),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )
    })

    it('Given a confirmed webview request, when its delivery callback throws, then the error callback fires, the review stays open and confirming again re-delivers', async () => {
        const { request, approve, reject, error } = buildTransactionSignRequest(
            {
                sourceType: 'webview',
                txs: [buildPaymentTransaction()],
            },
        )
        approve.mockRejectedValueOnce(new Error('delivery failed'))

        const { confirm } = renderSignReview(request)

        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        confirm()

        await waitFor(
            () => {
                expect(error).toHaveBeenCalledWith(
                    expect.objectContaining({ message: 'delivery failed' }),
                )
            },
            { timeout: 10_000 },
        )
        // A delivery failure is retryable, so the review stays up instead of the signing-failed view.
        expect(screen.queryByText('signing.signing_failed.title')).toBeNull()
        expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()

        confirm()

        await waitFor(
            () => {
                expect(approve).toHaveBeenCalledTimes(2)
            },
            { timeout: 10_000 },
        )
        expect(error).toHaveBeenCalledTimes(1)
        expect(reject).not.toHaveBeenCalled()
    })
})
