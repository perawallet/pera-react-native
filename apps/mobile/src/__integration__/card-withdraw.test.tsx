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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCardSessionStore } from '@perawallet/wallet-core-card'
import { PeraCardOverview } from '@modules/card/components/PeraCardOverview'
import { CardWithdrawScreen } from '@modules/card/screens/CardWithdrawScreen'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const ACCOUNT: WalletAccount = {
    id: 'withdraw-account',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'withdraw-account-key',
    name: 'Main Account',
}

const usdcWalletHandler = http.get('*/v1/wallet/internal', () =>
    HttpResponse.json(
        [
            {
                id: 'wallet_usdc',
                balance: '150.00',
                currency: 'usdc',
                address: 'BAANX_ADDR',
                addressMemo: null,
                addressId: 'addr_1',
                type: 'INTERNAL',
            },
        ],
        { status: 200 },
    ),
)

const activeCardStatus = http.get('*/v1/card/status', () =>
    HttpResponse.json(
        { id: 'card_1', panLast4: '4242', status: 'ACTIVE', type: 'VIRTUAL' },
        { status: 200 },
    ),
)

const emptyTransactions = http.get('*/v1/card/transactions', () =>
    HttpResponse.json([], { status: 200 }),
)

const renderOverviewWithWithdraw = () =>
    renderWithNavigation(PeraCardOverview, 'Overview', {
        additionalScreens: [
            { name: 'CardWithdraw', component: CardWithdrawScreen },
        ],
    })

// Navigates overview → withdraw screen and types "25" on the number pad.
// Keys are tapped while the amount display shows a different value, so each
// digit's text node is unambiguous.
const goToWithdrawAndTypeAmount = async () => {
    fireEvent.click(await screen.findByTestId('pera_card_withdraw_button'))

    expect(await screen.findByTestId('card-withdraw-amount')).toBeTruthy()
    fireEvent.click(screen.getByText('2'))
    fireEvent.click(screen.getByText('5'))
    expect(screen.getByTestId('card-withdraw-amount').textContent).toBe('25')
}

describe('Flow: Card withdraw', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT.address)
        // The internal-wallets query is gated on the card session.
        useCardSessionStore.getState().setAuthenticated(true)
        server.use(activeCardStatus, emptyTransactions, usdcWalletHandler)
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('withdraws USDC to the selected account through the confirmation sheet', async () => {
        let withdrawBody: Record<string, unknown> | null = null
        server.use(
            http.post('*/v1/wallet/internal/withdraw', async ({ request }) => {
                withdrawBody = (await request.json()) as Record<string, unknown>
                return HttpResponse.json({ success: true }, { status: 200 })
            }),
        )

        renderOverviewWithWithdraw()
        await goToWithdrawAndTypeAmount()

        // Enabling the button proves the real 150.00 card balance flowed
        // through the internal-wallets query (the old stub of 0 would keep
        // any positive amount disabled).
        fireEvent.click(screen.getByTestId('card_withdraw_button'))

        fireEvent.click(
            await screen.findByTestId('card_withdraw_confirm_button'),
        )

        await waitFor(() => expect(withdrawBody).not.toBeNull())
        expect(withdrawBody).toEqual({
            amount: '25',
            // Baanx's actual wire field name (typo, missing 'e').
            recipientAddrss: ACCOUNT.address,
            sourceAddress: 'BAANX_ADDR',
            currency: 'usdc',
        })

        // Success toast fired and we are back on the overview.
        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        expect(
            await screen.findByTestId('pera_card_withdraw_button'),
        ).toBeTruthy()
    })

    it('keeps the sheet open and surfaces an error toast when the balance is insufficient', async () => {
        server.use(
            http.post('*/v1/wallet/internal/withdraw', () =>
                HttpResponse.json(
                    { message: 'Insufficient balance' },
                    { status: 400 },
                ),
            ),
        )

        renderOverviewWithWithdraw()
        await goToWithdrawAndTypeAmount()

        fireEvent.click(screen.getByTestId('card_withdraw_button'))

        fireEvent.click(
            await screen.findByTestId('card_withdraw_confirm_button'),
        )

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        // The sheet stays open for a retry.
        expect(
            screen.getByTestId('card_withdraw_confirmation_sheet'),
        ).toBeTruthy()
    })
})
