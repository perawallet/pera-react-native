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

// The balance-impact summary rendered inside the live review sheet.
// Proves the pipeline → computeBalanceImpact → BalanceImpactSummary path wires
// up end-to-end: outgoing payments surface under the "you will spend" section.
// The summary lives on the multi-transaction group view (TransactionListScreen)
// — a single transaction conveys its impact through the signed header amount —
// so the group review is what we exercise here. (Integration i18n returns keys
// verbatim.) A group where nothing changes hands hides the summary entirely.

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
    renderSignReview,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
    drainPendingSignRequests,
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'

describe('Flow: balance-impact summary in the review sheet', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 50_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it('shows outgoing payments under the spend section', async () => {
        await seedAlgo25Signer()
        // A multi-transaction group renders TransactionListScreen, whose
        // header hosts the balance-impact summary.
        const { request } = buildTransactionSignRequest({
            txs: [
                buildPaymentTransaction({ amount: 2_000_000n }),
                buildPaymentTransaction({ amount: 1_000_000n }),
            ],
        })

        renderSignReview(request)

        await waitFor(
            () => {
                expect(
                    screen.getByTestId('balance-impact-summary'),
                ).toBeTruthy()
                expect(
                    screen.getByText('signing.balance_impact.spend_title'),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )
    })

    it('hides the summary when no assets change hands in the group', async () => {
        await seedAlgo25Signer()
        // Two self-payments: the signer is both sender and receiver, so each
        // nets to zero and no spend/receive movement remains. The group
        // still renders (transaction count), but the impact section — and
        // its flanking divider — must not.
        const selfPayment = () =>
            buildPaymentTransaction({
                receiver: REVIEW_SIGNER_ADDRESS,
                amount: 1_000_000n,
            })
        const { request } = buildTransactionSignRequest({
            txs: [selfPayment(), selfPayment()],
        })

        renderSignReview(request)

        await waitFor(
            () => {
                expect(
                    screen.getByText('signing.transactions.transactions_count'),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        expect(screen.queryByTestId('balance-impact-summary')).toBeNull()
    })
})
