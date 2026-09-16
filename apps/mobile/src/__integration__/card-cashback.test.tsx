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
import { useCardSessionStore } from '@perawallet/wallet-core-card'
import { CardCashbackScreen } from '@modules/card/screens/CardCashbackScreen'
import { CardCashbackWithdrawScreen } from '@modules/card/screens/CardCashbackWithdrawScreen'

const rewardWalletHandler = (isWithdrawable = true, balance = '42.50') =>
    http.get('*/v1/wallet/reward', () =>
        HttpResponse.json(
            {
                id: 'rw_1',
                balance,
                currency: 'usdc',
                isWithdrawable,
            },
            { status: 200 },
        ),
    )

const estimationHandler = http.get(
    '*/v1/wallet/reward/withdraw-estimation',
    () =>
        HttpResponse.json(
            { gas: '6219123007416', fee: '0.000006219' },
            { status: 200 },
        ),
)

const renderCashback = () =>
    renderWithNavigation(CardCashbackScreen, 'CardCashback', {
        additionalScreens: [
            {
                name: 'CardCashbackWithdraw',
                component: CardCashbackWithdrawScreen,
            },
        ],
    })

describe('Flow: Card cashback', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        // The reward-wallet query is gated on the card session.
        useCardSessionStore.getState().setAuthenticated(true)
        server.use(estimationHandler)
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('shows the balance and withdraws through the fee-quoted confirmation sheet', async () => {
        server.use(rewardWalletHandler())
        let withdrawBody: Record<string, unknown> | null = null
        server.use(
            http.post('*/v1/wallet/reward/withdraw', async ({ request }) => {
                withdrawBody = (await request.json()) as Record<string, unknown>
                return HttpResponse.json(
                    { txHash: '0xabc', network: 'linea', confirmed: true },
                    { status: 200 },
                )
            }),
        )

        renderCashback()

        // Balance flowed through the reward query.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-cashback-balance').textContent,
            ).toContain('42.50'),
        )

        fireEvent.click(screen.getByTestId('card-cashback-withdraw-cta'))

        expect(
            await screen.findByTestId('card-cashback-withdraw-amount'),
        ).toBeTruthy()
        fireEvent.click(screen.getByText('2'))
        fireEvent.click(screen.getByText('5'))
        fireEvent.click(screen.getByTestId('card_cashback_withdraw_button'))

        // The sheet fetched and rendered the fee quote.
        await waitFor(() =>
            expect(
                screen.getByTestId('cashback-withdraw-fee').textContent,
            ).toContain('0.000006219'),
        )

        fireEvent.click(
            await screen.findByTestId('cashback_withdraw_confirm_button'),
        )

        await waitFor(() => expect(withdrawBody).not.toBeNull())
        expect(withdrawBody).toEqual({ amount: '25.00' })

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
    })

    it('keeps the withdraw CTA disabled while the wallet is not withdrawable', async () => {
        server.use(rewardWalletHandler(false))

        renderCashback()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-cashback-balance').textContent,
            ).toContain('42.50'),
        )
        const cta = screen.getByTestId('card-cashback-withdraw-cta')
        expect(cta.getAttribute('disabled')).not.toBeNull()
    })
    it('shows an earning introduction for an empty wallet', async () => {
        server.use(rewardWalletHandler(true, '0'))
        renderCashback()
        expect(
            await screen.findByText('peraCard.cashback.empty_title'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card-cashback-balance').textContent,
        ).toContain('0.00')
        expect(
            screen
                .getByTestId('card-cashback-withdraw-cta')
                .getAttribute('disabled'),
        ).not.toBeNull()
    })

    it('retries a failed balance request without showing a false zero', async () => {
        server.use(
            http.get(
                '*/v1/wallet/reward',
                () => new HttpResponse(null, { status: 500 }),
            ),
        )
        renderCashback()
        const retry = await screen.findByTestId('card-cashback-retry')
        expect(screen.queryByTestId('card-cashback-balance')).toBeNull()
        expect(
            screen
                .getByTestId('card-cashback-withdraw-cta')
                .getAttribute('disabled'),
        ).not.toBeNull()
        server.use(rewardWalletHandler())
        fireEvent.click(retry)
        await waitFor(() =>
            expect(
                screen.getByTestId('card-cashback-balance').textContent,
            ).toContain('42.50'),
        )
        expect(screen.queryByTestId('card-cashback-retry')).toBeNull()
        expect(
            screen
                .getByTestId('card-cashback-withdraw-cta')
                .getAttribute('disabled'),
        ).toBeNull()
    })
})
