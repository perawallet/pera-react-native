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
import { useCardRewardWalletQuery } from '@perawallet/wallet-core-card'
import { useCardCashbackScreen } from '../useCardCashbackScreen'

vi.mock('@perawallet/wallet-core-card', () => ({
    useCardRewardWalletQuery: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

const wallet = {
    id: 'reward-1',
    balance: new Decimal('42.5'),
    currency: 'usdc',
    isWithdrawable: true,
}
const query = {
    rewardWallet: wallet,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
}

describe('useCardCashbackScreen', () => {
    beforeEach(() => {
        vi.mocked(useCardRewardWalletQuery).mockReturnValue(query)
    })

    it('does not present an unloaded wallet as a zero balance', () => {
        vi.mocked(useCardRewardWalletQuery).mockReturnValue({
            ...query,
            rewardWallet: null,
            isLoading: true,
        })
        const { result } = renderHook(useCardCashbackScreen)
        expect(result.current.balanceDisplay).toBeNull()
        expect(result.current.canWithdraw).toBe(false)
    })

    // Baanx creates the reward wallet on the first credited cashback, so a
    // settled query with no wallet is a real zero, not a pending load. Left as
    // null it would skeleton forever for every user who has yet to earn any.
    it('presents a settled wallet-less response as a zero balance', () => {
        vi.mocked(useCardRewardWalletQuery).mockReturnValue({
            ...query,
            rewardWallet: null,
            isLoading: false,
        })
        const { result } = renderHook(useCardCashbackScreen)
        expect(result.current.balanceDisplay).toBe('0.00')
        expect(result.current.hasBalance).toBe(false)
        expect(result.current.canWithdraw).toBe(false)
    })

    it('blocks withdrawal when refreshing a cached balance fails', () => {
        vi.mocked(useCardRewardWalletQuery).mockReturnValue({
            ...query,
            isError: true,
            error: new Error('Network unavailable'),
        })
        const { result } = renderHook(useCardCashbackScreen)
        expect(result.current.isError).toBe(true)
        expect(result.current.canWithdraw).toBe(false)
    })

    it.each([
        ['0', true, false, false],
        ['42.5', false, true, false],
        ['42.5', true, true, true],
    ])(
        'derives balance and withdrawal states for %s with withdrawable=%s',
        (balance, isWithdrawable, hasBalance, canWithdraw) => {
            vi.mocked(useCardRewardWalletQuery).mockReturnValue({
                ...query,
                rewardWallet: {
                    ...wallet,
                    balance: new Decimal(balance),
                    isWithdrawable,
                },
            })
            const { result } = renderHook(useCardCashbackScreen)
            expect(result.current.hasBalance).toBe(hasBalance)
            expect(result.current.canWithdraw).toBe(canWithdraw)
            expect(result.current.currencyDisplay).toBe('USDC')
            expect(result.current.balanceDisplay).toBe(
                balance === '0' ? '0.00' : '42.50',
            )
        },
    )
})
