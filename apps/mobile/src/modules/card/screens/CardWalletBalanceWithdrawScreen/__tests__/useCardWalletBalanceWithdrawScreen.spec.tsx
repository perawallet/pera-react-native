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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { CardWalletKind } from '@perawallet/wallet-core-chain-algorand/card'

const mockSuccessToast = vi.fn()
const mockRequestSheet = vi.fn()
const mockGoBack = vi.fn()
const mocks = vi.hoisted(() => ({
    wallet: null as unknown,
    kind: 'reward' as string,
    isFocused: true,
}))

const rewardWallet = {
    id: 'wallet_reward',
    balance: new Decimal('150'),
    currency: 'usdc',
    isWithdrawable: true,
}

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )
    return {
        ...actual,
        useCardWalletBalanceQuery: () => ({
            wallet: mocks.wallet,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        }),
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestSheet }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            goBack: mockGoBack,
            isFocused: () => mocks.isFocused,
        }),
        useRoute: () => ({ params: { kind: mocks.kind } }),
    }
})

vi.mock('../../../components/WalletWithdrawConfirmationSheet', () => ({
    WalletWithdrawConfirmationSheet: () => null,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            // Keeps the interpolated amount visible in assertions.
            t: (key: string, params?: { amount?: string }) =>
                params?.amount ? `${key}|${params.amount}` : key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { useCardWalletBalanceWithdrawScreen } from '../useCardWalletBalanceWithdrawScreen'

const type = (
    result: { current: ReturnType<typeof useCardWalletBalanceWithdrawScreen> },
    keys: string[],
) => keys.forEach(key => act(() => result.current.handleKey(key)))

describe('useCardWalletBalanceWithdrawScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.wallet = rewardWallet
        mocks.kind = CardWalletKind.Reward
        mocks.isFocused = true
    })

    it.each([
        [CardWalletKind.Reward, 'peraCard.rewards.withdraw_navigation_title'],
        [CardWalletKind.Credit, 'peraCard.refunds.withdraw_navigation_title'],
    ])("shows the %s balance with that wallet's copy", (kind, title) => {
        mocks.kind = kind

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )

        expect(result.current.balanceDisplay).toBe('150.00')
        expect(result.current.copy.withdrawNavigationTitle).toBe(title)
    })

    // The request carries two decimals, so the pad must not accept more:
    // otherwise 0.005 typed would be claimed as 0.01.
    it('caps the typed fraction at display precision', () => {
        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )

        type(result, ['.', '1', '2', '3'])
        expect(result.current.amount).toBe('0.12')
    })

    it('enables Claim only for a positive amount within the balance', () => {
        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )

        expect(result.current.isWithdrawDisabled).toBe(true)

        type(result, ['5'])
        expect(result.current.isWithdrawDisabled).toBe(false)

        type(result, ['0', '0', '0'])
        expect(result.current.amount).toBe('5000')
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('keeps Claim disabled while Baanx reports the wallet as not withdrawable', () => {
        mocks.wallet = { ...rewardWallet, isWithdrawable: false }

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )

        type(result, ['5'])
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('keeps Claim disabled without a wallet', () => {
        mocks.wallet = null

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )

        type(result, ['5'])
        expect(result.current.balanceDisplay).toBe('0.00')
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('opens the confirmation sheet for the route kind and finishes on confirm', async () => {
        mocks.kind = CardWalletKind.Credit
        mockRequestSheet.mockResolvedValue('confirm')

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockSuccessToast).toHaveBeenCalled())
        const request = mockRequestSheet.mock.calls[0][0]
        expect(request.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
        expect(request.contents.props.kind).toBe(CardWalletKind.Credit)
        expect(request.contents.props.amount.toString()).toBe('25')
        expect(mockSuccessToast).toHaveBeenCalledWith(
            'peraCard.credits.success_title',
            'peraCard.refunds.success_body|25.00',
        )
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('ignores a second Claim tap while the sheet request is in flight', async () => {
        let resolveSheet: (value: unknown) => void = () => undefined
        mockRequestSheet.mockImplementation(
            () => new Promise(resolve => (resolveSheet = resolve)),
        )

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())
        act(() => result.current.onWithdraw())

        expect(mockRequestSheet).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveSheet(undefined)
        })
    })

    it('skips goBack when the screen lost focus before the sheet resolved', async () => {
        mockRequestSheet.mockResolvedValue('confirm')
        mocks.isFocused = false

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockSuccessToast).toHaveBeenCalled())
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('does nothing when the sheet is dismissed', async () => {
        mockRequestSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() =>
            useCardWalletBalanceWithdrawScreen(),
        )
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockRequestSheet).toHaveBeenCalled())
        expect(mockSuccessToast).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
