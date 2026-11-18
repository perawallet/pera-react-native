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
// up end-to-end: outgoing payments surface on the "You send" side.
// BalanceImpactSummary is what the multi-transaction group view
// (TransactionListScreen) renders, so the group review is what we exercise here.
// (Integration i18n returns keys verbatim.) A group with no movements hides the
// summary unless an app call leaves its receive side unknown.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildApplicationCallTransaction,
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
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
    mockTransactionHistory,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { mockApplication } from '@perawallet/wallet-core-projects/test-handlers'

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
            mockTransactionHistory({
                accountAddress: REVIEW_SIGNER_ADDRESS,
                response: {
                    current_round: 1000,
                    next: null,
                    previous: null,
                    results: [],
                },
            }),
        )
    })

    it('shows outgoing payments on the send side of the wallet changes', async () => {
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
                const changes = within(
                    screen.getByTestId('balance-impact-summary'),
                ).getByTestId('review_wallet_changes')
                expect(
                    within(changes).getByTestId(
                        `review_wallet_send_${nativeAssetFor(ALGORAND_CHAIN_ID).assetId}`,
                    ),
                ).toBeTruthy()
                expect(
                    within(changes).getByTestId(
                        'review_wallet_receive_nothing',
                    ),
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

    it.each([1, 2])(
        'shows the unknown receive after simulating %i app calls with no asset movements',
        async transactionCount => {
            await seedAlgo25Signer()
            server.use(
                mockApplication({
                    applicationId: '123',
                    response: {
                        application_id: '123',
                        name: 'Test App',
                        project: {
                            name: 'Test Project',
                            url: 'https://example.com',
                            description: '',
                            short_description: '',
                            logo_png: '',
                            verification_tier: 'verified',
                        },
                    },
                }),
            )
            const { request } = buildTransactionSignRequest({
                txs: Array.from(
                    { length: transactionCount },
                    buildApplicationCallTransaction,
                ),
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    const changes = screen.getByTestId('review_wallet_changes')
                    expect(
                        within(changes).getByTestId(
                            'review_wallet_receive_unknown',
                        ).textContent,
                    ).toContain('signing.review.unknown_receive_body')
                    expect(
                        within(changes).queryByTestId(
                            'review_wallet_receive_nothing',
                        ),
                    ).toBeNull()
                    expect(
                        screen.queryByTestId('review_wallet_changes_loading'),
                    ).toBeNull()
                },
                { timeout: 10_000 },
            )
        },
    )
})
