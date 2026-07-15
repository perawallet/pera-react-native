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

// The empty-state counterpart to sign-review-balance-impact: when a group has
// transactions but nothing changes hands for the user, the balance-impact
// section (and its flanking divider) must not render. Lives in its own file
// because the signing-overlay driver shows the first pending interactive
// request, and resetting the signing store mid-suite disrupts the actor
// lifecycle — a fresh per-file module registry sidesteps both.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'

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
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'

const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: balance-impact summary hidden when nothing moves', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
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
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: REVIEW_SIGNER_ADDRESS,
                response: { amount: 50_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it(
        'hides the summary when no assets change hands in the group',
        async () => {
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
                        screen.getByText(
                            'signing.transactions.transactions_count',
                        ),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            expect(screen.queryByTestId('balance-impact-summary')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
