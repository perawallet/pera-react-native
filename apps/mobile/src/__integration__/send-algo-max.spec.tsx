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

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { decodeSignedTransaction } from 'algosdk'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { seedAlgo25Signer } from '@test-utils/signing-review'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountChainStateStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
    mockTransactionHistory,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { UserPreferences } from '@constants/user-preferences'

import { useSendFundsStore } from '@modules/transactions'
import { InputScreen } from '@modules/transactions/screens/send-funds/InputScreen/InputScreen'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS
const SENDER_BALANCE = 5_000_000
const SENDER_MIN_BALANCE = 100_000

type SubmitSpy = ReturnType<typeof vi.fn>

const captureSubmission = (): { spy: SubmitSpy; body: () => Uint8Array } => {
    let submitted: Uint8Array | null = null
    const spy = vi.fn(async ({ request }: { request: Request }) => {
        submitted = new Uint8Array(await request.arrayBuffer())
        return HttpResponse.json(
            { txId: 'MAXSENDTXID00000000000000000000000000000000000000000000' },
            { status: 200 },
        )
    })
    server.use(http.post('*/v2/transactions', spy))
    return { spy, body: () => submitted! }
}

const renderSendFromAmountInput = () =>
    renderWithNavigation(InputScreen, 'InputAmount', {
        additionalScreens: [
            {
                name: 'ConfirmTransaction',
                component: TransactionConfirmationScreen,
            },
            {
                name: 'TransactionProcessing',
                component: TransactionProcessingScreen,
            },
            {
                name: 'TransactionSuccess',
                component: TransactionSuccessScreen,
            },
        ],
    })

const enterMaxAndContinue = async () => {
    fireEvent.click(
        await findEnabledByTestId('send_input_max_button', { timeout: 5000 }),
    )
    await waitFor(() =>
        expect(
            (screen.getByTestId('send_input_amount') as HTMLInputElement)
                .textContent,
        ).toContain(new Decimal(SENDER_BALANCE).div(1e6).toString()),
    )
    fireEvent.click(await findEnabledByTestId('send_input_next_button'))
}

describe('Flow: Send the maximum ALGO amount', () => {
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
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useSettingsStore.getState().resetState()
        // Otherwise the first-send info sheet opens over the amount screen.
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.transactionInfoAgreed, true)

        await seedAlgo25Signer()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: LEGACY_CHAIN_ID, assetId: '0' })
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)

        server.use(
            // algod's `fee` is per byte; 0 (as on mainnet) prices every txn at min-fee.
            mockAlgodTransactionParams({ response: { fee: 0 } }),
            // An unraised minimum balance with no opt-ins is what lets MAX
            // offer closing the account.
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: SENDER_BALANCE,
                    'min-balance': SENDER_MIN_BALANCE,
                },
            }),
            mockAlgodAccountInformation({
                address: RECEIVER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
            mockTransactionHistory({
                accountAddress: ALGO25_TEST_ADDRESS,
                response: { results: [], current_round: 100 },
            }),
        )
    })

    it('Given an account that can be emptied, when the user sends MAX and chooses to close the account, then algod receives a zero-amount payment that closes the remainder to the receiver', async () => {
        const submission = captureSubmission()
        renderSendFromAmountInput()

        await enterMaxAndContinue()
        fireEvent.click(
            await findEnabledByTestId('close_account_confirm_button'),
        )

        await waitFor(() =>
            expect(screen.getByTestId('close_account_warning')).toBeTruthy(),
        )
        expect(useSendFundsStore.getState().isCloseAccount).toBe(true)

        fireEvent.click(
            await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
        )
        await waitFor(
            () => expect(screen.getByTestId('send_success')).toBeTruthy(),
            { timeout: 10_000 },
        )

        expect(submission.spy).toHaveBeenCalledTimes(1)
        const { txn } = decodeSignedTransaction(submission.body())
        expect(txn.sender.toString()).toBe(ALGO25_TEST_ADDRESS)
        expect(txn.payment?.receiver.toString()).toBe(RECEIVER_ADDRESS)
        expect(txn.payment?.amount).toBe(0n)
        expect(txn.payment?.closeRemainderTo?.toString()).toBe(RECEIVER_ADDRESS)
    })

    it('Given an account that can be emptied, when the user sends MAX and keeps the account open, then algod receives a plain payment of the balance above the minimum balance and fee', async () => {
        const submission = captureSubmission()
        renderSendFromAmountInput()

        await enterMaxAndContinue()
        fireEvent.click(
            await findEnabledByTestId('close_account_keep_open_button'),
        )

        fireEvent.click(
            await findEnabledByTestId('send_confirm_button', { timeout: 5000 }),
        )
        expect(screen.queryByTestId('close_account_warning')).toBeNull()
        expect(useSendFundsStore.getState().isCloseAccount).toBe(false)

        await waitFor(
            () => expect(screen.getByTestId('send_success')).toBeTruthy(),
            { timeout: 10_000 },
        )

        expect(submission.spy).toHaveBeenCalledTimes(1)
        const { txn } = decodeSignedTransaction(submission.body())
        expect(txn.payment?.closeRemainderTo).toBeUndefined()
        expect(txn.payment?.amount).toBe(
            BigInt(SENDER_BALANCE - SENDER_MIN_BALANCE) - txn.fee,
        )
    })
})
