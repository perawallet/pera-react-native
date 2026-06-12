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

// Phase 1 — a transaction whose signer is a multisig account the wallet can't
// meet threshold for must surface the "cannot sign" notice up front instead of
// the slide-to-confirm control.

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
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'

const SLOW_TEST_TIMEOUT_MS = 30_000

// A multisig account whose participants the wallet holds no key for — so the
// request is unsignable. The account's own address is the tx sender.
const MSIG_ADDRESS = REVIEW_RECEIVER_ADDRESS
const unsignableMultisig: MultiSigAccount = {
    id: 'msig-unsignable',
    type: AccountTypes.multisig,
    address: MSIG_ADDRESS,
    name: 'Shared (unsignable)',
    multisigDetails: {
        threshold: 1,
        addresses: [REVIEW_SIGNER_ADDRESS],
        version: 1,
    },
}

describe('Flow: multisig-unsignable transaction review', () => {
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
        // Only the multisig account is in the wallet — none of its
        // participants are signable.
        useAccountsStore.getState().setAccounts([unsignableMultisig])
    })

    it(
        'shows the cannot-sign notice and hides the slide-to-confirm control',
        async () => {
            const { request } = buildTransactionSignRequest({
                txs: [buildPaymentTransaction({ sender: MSIG_ADDRESS })],
            })

            renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-cannot-sign'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('signing-confirm-slide')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
