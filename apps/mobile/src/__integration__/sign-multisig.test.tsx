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

// Phase 2 — multisig signing through the review UI. An external (WalletConnect)
// transaction whose signer is a multisig account the wallet holds a local
// participant of: confirm → the multisig strategy signs the participant → the
// propose transport POSTs the sign request to the joint-accounts backend.

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
} from '@perawallet/wallet-core-accounts'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-blockchain/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The multisig account's address is the transaction sender; the seeded Algo25
// signer is its (only) participant, so the wallet can sign for it.
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

describe('Flow: multisig signing review (propose)', () => {
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
        // The review sheet renders the sender's balance; with no balance row in
        // the fresh DB, useAccountBalancesQuery self-heals with a background
        // algod account read. Unhandled, that request escapes to the live node
        // and its logging races vitest's worker teardown ("Closing rpc while
        // onUserConsoleLog was pending"), failing CI.
        server.use(
            mockAlgodAccountInformation({
                address: MSIG_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
        useAccountsStore.getState().setAccounts([])
        // The propose transport requires a registered device id before it
        // creates the backend sign-request (handoff precondition).
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('mainnet', 'test-device-id')
        useDeviceStore.getState().setDeviceID('testnet', 'test-device-id')
        // Seed the participant's key, then register both it and the multisig
        // account so the wallet can sign for the multisig.
        await seedAlgo25Signer()
        useAccountsStore
            .getState()
            .setAccounts([
                ...useAccountsStore.getState().accounts,
                multisigAccount,
            ])
    })

    it(
        'proposes the sign request to the backend when the user confirms a multisig dApp transaction',
        async () => {
            const proposeSpy = vi.fn(() =>
                HttpResponse.json(proposeResponse, { status: 200 }),
            )
            server.use(
                http.post('*/v1/joint-accounts/sign-requests/', proposeSpy),
            )

            const { request, reject } = buildTransactionSignRequest({
                txs: [buildPaymentTransaction({ sender: MSIG_ADDRESS })],
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

            // The participant's signature is proposed to the joint-accounts
            // backend.
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

    // Cosign (multisig-cosign source → addSignatures) and deferred propose
    // (hardware-only proposer → local draft) are driven in production by the
    // multisig inbox with participant-specific wiring this generic harness
    // doesn't reproduce; tracked as remaining in the test plan.
})
