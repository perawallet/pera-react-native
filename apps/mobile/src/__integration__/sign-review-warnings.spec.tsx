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

// Phase 1 — safety guardrails surfaced in the review sheet. Asserts that the
// warning panel appears for close / high-fee transactions, and that a rekey
// transaction triggers the security-guard gate (rekey support disabled) on
// confirm instead of signing. i18n returns keys verbatim in tests, so
// assertions match i18n keys.

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
    fireEvent,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { UserPreferences } from '@constants/user-preferences'

const expectWarningPanel = async () => {
    await waitFor(
        () => {
            expect(screen.getByText('transactions.warning.title')).toBeTruthy()
        },
        { timeout: 10_000 },
    )
}

describe('Flow: signing review safety warnings', () => {
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
                response: { amount: 50_000_000, 'min-balance': 100_000 },
            }),
        )
        await seedAlgo25Signer()
        drainPendingSignRequests()
    })

    it('surfaces the warning panel for a close-account transaction', async () => {
        const { request } = buildTransactionSignRequest({
            txs: [
                buildPaymentTransaction({
                    closeRemainderTo: REVIEW_RECEIVER_ADDRESS,
                }),
            ],
        })
        renderSignReview(request)
        await expectWarningPanel()
    })

    it('surfaces the warning panel for an unusually high fee', async () => {
        // 2 ALGO fee on a single payment — well over the 0.5 ALGO group budget.
        const { request } = buildTransactionSignRequest({
            txs: [buildPaymentTransaction({ fee: 2_000_000n })],
        })
        renderSignReview(request)
        await expectWarningPanel()
    })

    it('surfaces the warning panel for a rekey transaction', async () => {
        const { request } = buildTransactionSignRequest({
            txs: [
                buildPaymentTransaction({
                    rekeyTo: REVIEW_RECEIVER_ADDRESS,
                }),
            ],
        })
        renderSignReview(request)
        await expectWarningPanel()
    })

    const renderRekeyReview = async () => {
        const built = buildTransactionSignRequest({
            sourceType: 'webview',
            txs: [
                buildPaymentTransaction({ rekeyTo: REVIEW_RECEIVER_ADDRESS }),
            ],
        })
        const { confirm } = renderSignReview(built.request)
        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        confirm()
        return built
    }

    it('Given rekey support is disabled, when the user confirms a rekey and cancels the security guard, then nothing is signed and the review stays open', async () => {
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.rekeySupportEnabled, false)

        const { approve, reject } = await renderRekeyReview()

        await waitFor(
            () => {
                expect(
                    screen.getByText(
                        'transactions.warning.rekey_confirm_title',
                    ),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        // The review behind the sheet has its own Cancel; the guard sheet renders last.
        const cancels = screen.getAllByText('common.cancel.label')
        fireEvent.click(cancels[cancels.length - 1])

        await waitFor(() => {
            expect(
                screen.queryByText('transactions.warning.rekey_confirm_title'),
            ).toBeNull()
        })
        expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
        expect(approve).not.toHaveBeenCalled()
        expect(reject).not.toHaveBeenCalled()
    })

    it('Given rekey support is enabled, when the user confirms a rekey and continues past the security guard, then the request is signed and delivered', async () => {
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.rekeySupportEnabled, true)

        const { approve } = await renderRekeyReview()

        await waitFor(
            () => {
                expect(
                    screen.getByText(
                        'transactions.warning.rekey_are_you_sure_title',
                    ),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        expect(approve).not.toHaveBeenCalled()
        fireEvent.click(
            screen.getByText(
                'transactions.warning.rekey_are_you_sure_continue',
            ),
        )

        await waitFor(
            () => {
                expect(approve).toHaveBeenCalled()
            },
            { timeout: 10_000 },
        )
    })
})
