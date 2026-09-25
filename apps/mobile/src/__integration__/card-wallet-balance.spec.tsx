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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    CardWalletKind,
    useCardSessionStore,
} from '@perawallet/wallet-core-card'
import {
    mockGetWalletBalance,
    mockGetWalletHistory,
    mockGetWalletWithdrawEstimation,
} from '@perawallet/wallet-core-card/test-handlers'
import { CardWalletBalanceScreen } from '@modules/card/screens/CardWalletBalanceScreen'
import { CardWalletBalanceWithdrawScreen } from '@modules/card/screens/CardWalletBalanceWithdrawScreen'
import { isElementDisabled } from '@test-utils/rnw'

const walletHandler = (
    kind: CardWalletKind,
    { isWithdrawable = true, balance = '42.50' } = {},
) =>
    mockGetWalletBalance({
        kind,
        response: {
            id: `${kind}_1`,
            balance,
            currency: 'usdc',
            isWithdrawable,
        },
    })

const missingWalletHandler = (kind: CardWalletKind) =>
    http.get(`*/v1/wallet/${kind}`, () =>
        HttpResponse.json({ message: 'Wallet not found' }, { status: 404 }),
    )

const renderWallet = (kind: CardWalletKind) =>
    renderWithNavigation(CardWalletBalanceScreen, 'CardWalletBalance', {
        initialParams: { kind },
        additionalScreens: [
            {
                name: 'CardWalletBalanceWithdraw',
                component: CardWalletBalanceWithdrawScreen,
            },
        ],
    })

const balanceText = () =>
    screen.getByTestId('card-wallet-balance-amount').textContent
const claimCta = () => screen.getByTestId('card-wallet-balance-claim-cta')

describe('Flow: card wallet balance claim', () => {
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        // The wallet queries are gated on the card session.
        useCardSessionStore.getState().setAuthenticated(true)
    })

    // Rewards and refunds share one screen and one contract; every case runs
    // per kind so a regression in the parametrization cannot hide behind the
    // other wallet.
    describe.each([CardWalletKind.Reward, CardWalletKind.Credit])(
        '%s wallet',
        kind => {
            beforeEach(() => {
                server.use(
                    mockGetWalletWithdrawEstimation({
                        kind,
                        response: { gas: '6219123007416', fee: '0.000006219' },
                    }),
                    mockGetWalletHistory({ kind }),
                )
            })

            it('shows the balance and claims through the fee-quoted confirmation sheet', async () => {
                server.use(walletHandler(kind))
                let withdrawBody: Record<string, unknown> | null = null
                server.use(
                    http.post(
                        `*/v1/wallet/${kind}/withdraw`,
                        async ({ request }) => {
                            withdrawBody = (await request.json()) as Record<
                                string,
                                unknown
                            >
                            return HttpResponse.json(
                                {
                                    txHash: '0xabc',
                                    network: 'linea',
                                    confirmed: true,
                                },
                                { status: 200 },
                            )
                        },
                    ),
                )

                renderWallet(kind)

                await waitFor(() => expect(balanceText()).toContain('42.50'))
                // History for this wallet rendered under the balance.
                expect(await screen.findByText('Coffee refund')).toBeTruthy()

                fireEvent.click(claimCta())

                expect(
                    await screen.findByTestId(
                        'card-wallet-balance-withdraw-amount',
                    ),
                ).toBeTruthy()
                fireEvent.click(screen.getByText('2'))
                fireEvent.click(screen.getByText('5'))
                fireEvent.click(
                    screen.getByTestId('card_wallet_balance_withdraw_button'),
                )

                // The sheet fetched and rendered the fee quote.
                await waitFor(() =>
                    expect(
                        screen.getByTestId('wallet-withdraw-fee').textContent,
                    ).toContain('0.000006219'),
                )

                fireEvent.click(
                    await screen.findByTestId('wallet_withdraw_confirm_button'),
                )

                // The POST went to this wallet's route, with the typed amount.
                await waitFor(() => expect(withdrawBody).not.toBeNull())
                expect(withdrawBody).toEqual({ amount: '25.00' })

                await waitFor(() =>
                    expect(Notifier.showNotification).toHaveBeenCalled(),
                )
            })

            it('keeps the claim CTA disabled while the wallet is not withdrawable', async () => {
                server.use(walletHandler(kind, { isWithdrawable: false }))

                renderWallet(kind)

                await waitFor(() => expect(balanceText()).toContain('42.50'))
                expect(isElementDisabled(claimCta())).toBe(true)
            })

            it('shows an introduction for an empty wallet', async () => {
                server.use(walletHandler(kind, { balance: '0' }))

                renderWallet(kind)

                const emptyTitle =
                    kind === CardWalletKind.Reward
                        ? 'peraCard.rewards.empty_title'
                        : 'peraCard.refunds.empty_title'
                expect(await screen.findByText(emptyTitle)).toBeTruthy()
                expect(balanceText()).toContain('0.00')
                expect(isElementDisabled(claimCta())).toBe(true)
            })

            // Baanx creates the wallet on the first credit, so 404 is the
            // normal state for a new card: a zero balance, not an error.
            it('treats a missing wallet as an empty balance', async () => {
                server.use(missingWalletHandler(kind))

                renderWallet(kind)

                await waitFor(() => expect(balanceText()).toContain('0.00'))
                expect(
                    screen.queryByTestId('card-wallet-balance-retry'),
                ).toBeNull()
                expect(isElementDisabled(claimCta())).toBe(true)
            })

            it('retries a failed balance request without showing a false zero', async () => {
                server.use(
                    http.get(
                        `*/v1/wallet/${kind}`,
                        () => new HttpResponse(null, { status: 500 }),
                    ),
                )
                renderWallet(kind)
                const retry = await screen.findByTestId(
                    'card-wallet-balance-retry',
                )
                expect(
                    screen.queryByTestId('card-wallet-balance-amount'),
                ).toBeNull()
                expect(isElementDisabled(claimCta())).toBe(true)
                server.use(walletHandler(kind))
                fireEvent.click(retry)
                await waitFor(() => expect(balanceText()).toContain('42.50'))
                expect(
                    screen.queryByTestId('card-wallet-balance-retry'),
                ).toBeNull()
                expect(isElementDisabled(claimCta())).toBe(false)
            })
        },
    )

    // Forgetting the kind in a query key would let the reward balance leak
    // into the refunds screen through the cache.
    it('does not show the rewards balance on the refunds screen', async () => {
        server.use(
            walletHandler(CardWalletKind.Reward, { balance: '42.50' }),
            missingWalletHandler(CardWalletKind.Credit),
        )

        renderWallet(CardWalletKind.Credit)

        await waitFor(() => expect(balanceText()).toContain('0.00'))
        expect(balanceText()).not.toContain('42.50')
    })
})
