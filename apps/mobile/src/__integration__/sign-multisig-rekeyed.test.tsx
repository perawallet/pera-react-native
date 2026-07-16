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

// A sender rekeyed on-chain to a Pera-held multisig must dispatch to the
// multisig propose path end-to-end, keyed on the AUTH account's template.
// Previously such a request died at machine init with CannotSignError.
// Isolated in its own file: the propose sync-flow leaves its request pending,
// which would shadow any later test in the same file.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'

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
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type MultiSigAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

import { REKEY_TARGET_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The seeded Algo25 signer is the multisig's (only) participant; the sender
// is a watch account whose on-chain auth is the multisig.
const MSIG_ADDRESS = REVIEW_RECEIVER_ADDRESS

const multisigAccount: MultiSigAccount = {
    id: 'msig-signable',
    type: AccountTypes.multisig,
    address: MSIG_ADDRESS,
    name: 'Shared',
    multisigDetails: {
        threshold: 1,
        addresses: [REVIEW_SIGNER_ADDRESS],
        version: 1,
    },
}

const rekeyedSender: WalletAccount = {
    id: 'rekeyed-to-msig',
    type: AccountTypes.watch,
    address: REKEY_TARGET_ADDRESS,
    name: 'Rekeyed to shared',
    rekeyAddress: MSIG_ADDRESS,
}

// A schema-valid joint-accounts propose response (signRequestResponseSchema).
const proposeResponse = {
    id: 'sign-request-1',
    status: 'pending',
    type: 'sync',
    creation_datetime: '2026-01-01T00:00:00Z',
    expected_expire_datetime: '2026-01-02T00:00:00Z',
    fail_reason_display: null,
    joint_account: {
        custom_id: 'msig-custom-1',
        creation_datetime: '2026-01-01T00:00:00Z',
        address: MSIG_ADDRESS,
        version: 1,
        threshold: 1,
        participant_addresses: [REVIEW_SIGNER_ADDRESS],
    },
    transaction_lists: [
        {
            id: 'tx-list-1',
            raw_transactions: ['AQID'],
            first_valid_block: 1000,
            last_valid_block: 2000,
            expected_expire_datetime: '2026-01-02T00:00:00Z',
            responses: [{ address: REVIEW_SIGNER_ADDRESS, response: 'signed' }],
        },
    ],
    proposer_address: REVIEW_SIGNER_ADDRESS,
}

describe('Flow: signing review for a sender rekeyed to a held multisig', () => {
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
        await seedAlgo25Signer()
        useAccountsStore
            .getState()
            .setAccounts([
                ...useAccountsStore.getState().accounts,
                multisigAccount,
                rekeyedSender,
            ])
    })

    it(
        'proposes via the auth multisig when the user confirms the send',
        async () => {
            const proposeSpy = vi.fn(() =>
                HttpResponse.json(proposeResponse, { status: 200 }),
            )
            server.use(
                http.post('*/v1/joint-accounts/sign-requests/', proposeSpy),
            )

            const { request, reject } = buildTransactionSignRequest({
                txs: [
                    buildPaymentTransaction({
                        sender: REKEY_TARGET_ADDRESS,
                        receiver: REVIEW_SIGNER_ADDRESS,
                    }),
                ],
            })

            const { confirm } = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            confirm()

            await waitFor(
                () => {
                    expect(proposeSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(reject).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
