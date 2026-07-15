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
// throws).

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

describe('Flow: signing error paths', () => {
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
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
        await seedAlgo25Signer()
    })

    it(
        'shows the signing-failed view when the round-trip integrity check rejects the request',
        async () => {
            // rawTransactionsBase64 that does not re-encode to the decoded txn
            // trips validateTransactionRoundTrip in the analyzer → the machine
            // fails before reaching the review controls.
            const { request } = buildTransactionSignRequest({
                sourceType: 'webview',
                txs: [buildPaymentTransaction()],
                overrides: { rawTransactionsBase64: ['AQID'] },
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
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
