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

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { seedAlgo25Signer } from '@test-utils/signing-review'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAssets,
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
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
    mockTransactionHistory,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { UserPreferences } from '@constants/user-preferences'

import { useSendFundsStore } from '@modules/transactions'
import { InputScreen } from '@modules/transactions/screens/send-funds/InputScreen/InputScreen'
import { AssetInboxSendSummaryScreen } from '@modules/transactions/screens/send-funds/AssetInboxSendSummaryScreen'
import { InsufficientBalanceScreen } from '@modules/transactions/screens/send-funds/InsufficientBalanceScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { USDC_TEST_ASSET, USDC_TEST_ASSET_ID } from './__fixtures__/assets'

// Not a wallet account and not opted in, so the ASA routes through ARC-59.
const EXTERNAL_RECEIVER = HD_TEST_ADDRESS
const SENDER_MIN_BALANCE = 200_000
const ARC59_FUND_AMOUNT = 100_000
const ARC59_MBR = 100_000

const mockSenderAlgo = (amount: number) =>
    mockAlgodAccountInformation({
        address: ALGO25_TEST_ADDRESS,
        response: {
            amount,
            'min-balance': SENDER_MIN_BALANCE,
            assets: [
                {
                    'asset-id': Number(USDC_TEST_ASSET_ID),
                    amount: 10_000_000,
                    'is-frozen': false,
                },
            ],
        },
    })

// The asa-inbox `mockArc59SendSummary` factory isn't aliased into apps/mobile.
const arc59SendSummary = http.get(
    `*/v1/asa-inboxes/summary/send-flow/${EXTERNAL_RECEIVER}/${USDC_TEST_ASSET_ID}/`,
    () =>
        HttpResponse.json({
            is_arc59_opted_in: false,
            minimum_balance_requirement: ARC59_MBR,
            inner_tx_count: 2,
            total_protocol_and_mbr_fee: ARC59_FUND_AMOUNT + ARC59_MBR,
            inbox_address: null,
            algo_fund_amount: ARC59_FUND_AMOUNT,
            warning_message: null,
        }),
)

const sendAsaToExternalReceiver = async () => {
    renderWithNavigation(InputScreen, 'InputAmount', {
        additionalScreens: [
            {
                name: 'AssetInboxSendSummary',
                component: AssetInboxSendSummaryScreen,
            },
            {
                name: 'InsufficientBalance',
                component: InsufficientBalanceScreen,
            },
        ],
    })
    fireEvent.click(
        await findEnabledByTestId('send_input_max_button', { timeout: 5000 }),
    )
    fireEvent.click(await findEnabledByTestId('send_input_next_button'))
}

describe('Flow: Send an ASA without enough ALGO to fund the receiver inbox', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedAssets([USDC_TEST_ASSET], 'mainnet')

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
        useSendFundsStore.getState().setSelectedAsset({
            chainId: LEGACY_CHAIN_ID,
            assetId: USDC_TEST_ASSET_ID,
        })
        useSendFundsStore.getState().setDestination(EXTERNAL_RECEIVER)

        server.use(
            mockAlgodTransactionParams({ response: { fee: 0 } }),
            mockAlgodAccountInformation({
                address: EXTERNAL_RECEIVER,
                response: { amount: 1_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts(),
            mockTransactionHistory({
                accountAddress: ALGO25_TEST_ADDRESS,
                response: { results: [], current_round: 100 },
            }),
            arc59SendSummary,
        )
    })

    it('Given the sender cannot cover the inbox funding, when the ASA send is routed to the ARC-59 summary, then it is replaced by the insufficient balance screen', async () => {
        // 250_000 - 200_000 min balance leaves 50_000 µALGO, short of 200_000.
        server.use(mockSenderAlgo(250_000))

        await sendAsaToExternalReceiver()

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('send_insufficient_balance'),
                ).toBeTruthy(),
            { timeout: 5000 },
        )
        expect(useSendFundsStore.getState().sendMode).toBe('sendAssetInbox')
        expect(
            screen.queryByTestId('asset_inbox_send_confirm_slide'),
        ).toBeNull()
    })

    it('Given the insufficient balance screen is shown, when the user taps Done, then the flow returns to the amount screen', async () => {
        server.use(mockSenderAlgo(250_000))

        await sendAsaToExternalReceiver()
        fireEvent.click(
            await findEnabledByTestId('send_insufficient_balance-primary', {
                timeout: 5000,
            }),
        )

        await waitFor(() =>
            expect(screen.getByTestId('send_input_next_button')).toBeTruthy(),
        )
        expect(screen.queryByTestId('send_insufficient_balance')).toBeNull()
    })

    it('Given the sender can cover the inbox funding, when the ASA send is routed to the ARC-59 summary, then the summary stays up with its send control', async () => {
        server.use(mockSenderAlgo(5_000_000))

        await sendAsaToExternalReceiver()

        await findEnabledByTestId('asset_inbox_send_confirm_slide', {
            timeout: 5000,
        })
        expect(screen.queryByTestId('send_insufficient_balance')).toBeNull()
    })
})
