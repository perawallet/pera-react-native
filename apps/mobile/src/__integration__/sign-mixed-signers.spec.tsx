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

// A group two of the wallet's accounts sign in different ways: a standard
// account's key and a quantum account's. Each slot is signed by its own
// account and the whole group is delivered at once.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { decodeSignedTransaction } from 'algosdk'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { groupTransactions } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    buildPaymentTransaction,
    buildTransactionSignRequest,
    drainPendingSignRequests,
    fireEvent,
    renderSignReview,
    screen,
    seedAlgo25Signer,
    seedQuantumSigner,
    waitFor,
} from '@test-utils/signing-review'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'

describe('Flow: one group signed by a standard and a quantum account', () => {
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
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
        )
    })

    it('Given a dApp group with a slot for each account, when the user confirms, then every slot comes back signed by its own account', async () => {
        await seedAlgo25Signer()
        await seedQuantumSigner()
        const group = [
            buildPaymentTransaction({
                sender: REVIEW_SIGNER_ADDRESS,
                receiver: REVIEW_RECEIVER_ADDRESS,
            }),
            buildPaymentTransaction({
                sender: QUANTUM_TEST_ADDRESS,
                receiver: REVIEW_RECEIVER_ADDRESS,
                fee: 3000n,
            }),
        ]
        // Assigns the group id in place.
        groupTransactions(group)
        const { request, approve, error } = buildTransactionSignRequest({
            txs: group,
        })

        const { confirm } = renderSignReview(request)

        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 15_000 },
        )
        confirm()
        // A quantum signer asks once more before signing a dApp's request.
        await waitFor(() => {
            expect(
                screen.getByText('quantum.dapp_warning.confirm'),
            ).toBeTruthy()
        })
        fireEvent.click(screen.getByText('quantum.dapp_warning.confirm'))

        await waitFor(
            () => {
                expect(approve).toHaveBeenCalled()
            },
            { timeout: 15_000 },
        )
        expect(error).not.toHaveBeenCalled()
        const delivered = approve.mock.calls[0][0] as SignedTransaction[]
        const [standard, quantum] = delivered.map(signed =>
            decodeSignedTransaction(signed.bytes),
        )
        expect(standard.txn.sender.toString()).toBe(REVIEW_SIGNER_ADDRESS)
        expect(quantum.txn.sender.toString()).toBe(QUANTUM_TEST_ADDRESS)
        expect(quantum.pqsig?.sig).toBeInstanceOf(Uint8Array)
    })
})
