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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    CardWalletKind,
    TransactionSign,
    useCardWalletBalanceQuery,
    useCardWalletHistoryQuery,
} from '@perawallet/wallet-core-chain-algorand/card'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    routeParams: { kind: 'reward' } as
        | { kind?: 'reward' | 'credit' }
        | undefined,
}))

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => ({
    ...(await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )),
    useCardWalletBalanceQuery: vi.fn(),
    useCardWalletHistoryQuery: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))
vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useRoute: () => ({ params: mocks.routeParams }),
}))

import { useCardWalletBalanceScreen } from '../useCardWalletBalanceScreen'

const wallet = {
    id: 'reward-1',
    balance: new Decimal('42.5'),
    currency: 'usdc',
    isWithdrawable: true,
}
const query = {
    wallet,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
}
const entry = (name: string, dateTime: string) => ({
    name,
    amount: new Decimal('4.5'),
    currency: 'usdc',
    sign: TransactionSign.Credit,
    dateTime,
})
const history = {
    entries: [] as ReturnType<typeof entry>[],
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
}

describe('useCardWalletBalanceScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.routeParams = { kind: 'reward' }
        vi.mocked(useCardWalletBalanceQuery).mockReturnValue(query)
        vi.mocked(useCardWalletHistoryQuery).mockReturnValue(history)
    })

    // History is keyed on the wallet id, so it must follow the balance query's
    // wallet rather than be asked for blindly.
    it('reads history for the loaded wallet', () => {
        renderHook(useCardWalletBalanceScreen)

        expect(useCardWalletHistoryQuery).toHaveBeenCalledWith(
            CardWalletKind.Reward,
            'reward-1',
        )
    })

    it('groups history into month sections, newest first', () => {
        vi.mocked(useCardWalletHistoryQuery).mockReturnValue({
            ...history,
            entries: [
                entry('older', '2026-07-02T10:00:00Z'),
                entry('newer', '2026-09-10T09:15:00Z'),
            ],
        })

        const { result } = renderHook(useCardWalletBalanceScreen)

        expect(result.current.hasHistory).toBe(true)
        expect(result.current.historySections.map(s => s.key)).toEqual([
            '2026-09',
            '2026-07',
        ])
    })

    it('asks for the next history page only while one exists and none is in flight', () => {
        const fetchNextPage = vi.fn()
        vi.mocked(useCardWalletHistoryQuery).mockReturnValue({
            ...history,
            hasNextPage: true,
            fetchNextPage,
        })
        const { result, rerender } = renderHook(useCardWalletBalanceScreen)
        result.current.handleLoadMore()
        expect(fetchNextPage).toHaveBeenCalledTimes(1)

        vi.mocked(useCardWalletHistoryQuery).mockReturnValue({
            ...history,
            hasNextPage: true,
            isFetchingNextPage: true,
            fetchNextPage,
        })
        rerender()
        result.current.handleLoadMore()
        expect(fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it.each([
        [CardWalletKind.Reward, 'peraCard.rewards.navigation_title'],
        [CardWalletKind.Credit, 'peraCard.refunds.navigation_title'],
    ])(
        'reads the %s wallet and presents its own copy',
        (kind, navigationTitle) => {
            mocks.routeParams = { kind }

            const { result } = renderHook(useCardWalletBalanceScreen)

            expect(useCardWalletBalanceQuery).toHaveBeenCalledWith(kind)
            expect(result.current.kind).toBe(kind)
            expect(result.current.copy.navigationTitle).toBe(navigationTitle)
        },
    )

    it('carries the wallet kind into the claim screen', () => {
        mocks.routeParams = { kind: CardWalletKind.Credit }

        const { result } = renderHook(useCardWalletBalanceScreen)
        result.current.handleWithdraw()

        expect(mocks.navigate).toHaveBeenCalledWith(
            'CardWalletBalanceWithdraw',
            { kind: CardWalletKind.Credit },
        )
    })

    // Only reachable by a bug in a caller, but the screen must still render
    // something sensible rather than crash on an undefined presentation.
    it('falls back to the rewards wallet without a route param', () => {
        mocks.routeParams = undefined

        const { result } = renderHook(useCardWalletBalanceScreen)

        expect(result.current.kind).toBe(CardWalletKind.Reward)
    })

    it('does not present an unloaded wallet as a zero balance', () => {
        vi.mocked(useCardWalletBalanceQuery).mockReturnValue({
            ...query,
            wallet: null,
            isLoading: true,
        })
        const { result } = renderHook(useCardWalletBalanceScreen)
        expect(result.current.balanceDisplay).toBeNull()
        expect(result.current.canWithdraw).toBe(false)
    })

    // Baanx creates the wallet on the first credit, so a settled query with no
    // wallet is a real zero, not a pending load. Left as null it would skeleton
    // forever for every user who has yet to earn anything.
    it('presents a settled wallet-less response as a zero balance', () => {
        vi.mocked(useCardWalletBalanceQuery).mockReturnValue({
            ...query,
            wallet: null,
            isLoading: false,
        })
        const { result } = renderHook(useCardWalletBalanceScreen)
        expect(result.current.balanceDisplay).toBe('0.00')
        expect(result.current.hasBalance).toBe(false)
        expect(result.current.canWithdraw).toBe(false)
    })

    it('blocks the claim when refreshing a cached balance fails', () => {
        vi.mocked(useCardWalletBalanceQuery).mockReturnValue({
            ...query,
            isError: true,
            error: new Error('Network unavailable'),
        })
        const { result } = renderHook(useCardWalletBalanceScreen)
        expect(result.current.isError).toBe(true)
        expect(result.current.canWithdraw).toBe(false)
    })

    it.each([
        ['0', true, false, false],
        ['42.5', false, true, false],
        ['42.5', true, true, true],
    ])(
        'derives balance and claim states for %s with withdrawable=%s',
        (balance, isWithdrawable, hasBalance, canWithdraw) => {
            vi.mocked(useCardWalletBalanceQuery).mockReturnValue({
                ...query,
                wallet: {
                    ...wallet,
                    balance: new Decimal(balance),
                    isWithdrawable,
                },
            })
            const { result } = renderHook(useCardWalletBalanceScreen)
            expect(result.current.hasBalance).toBe(hasBalance)
            expect(result.current.canWithdraw).toBe(canWithdraw)
            expect(result.current.currencyDisplay).toBe('USDC')
            expect(result.current.balanceDisplay).toBe(
                balance === '0' ? '0.00' : '42.50',
            )
        },
    )
})
