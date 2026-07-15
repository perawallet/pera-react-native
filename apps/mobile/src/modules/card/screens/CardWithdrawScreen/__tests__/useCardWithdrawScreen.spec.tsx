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

const mockSuccessToast = vi.fn()
const mockInvalidate = vi.fn()
const mockRequestSheet = vi.fn()
const mockGoBack = vi.fn()
const mocks = vi.hoisted(() => ({
    usdcWallet: null as unknown,
    selectedAccount: null as unknown,
    isFocused: true,
}))

const usdcWallet = {
    id: 'wallet_usdc',
    balance: new Decimal('150'),
    currency: 'usdc',
    address: 'BAANX_ADDR',
    addressMemo: null,
    addressId: 'addr_1',
    type: 'INTERNAL',
}

const account = { address: 'ALGO_RECIPIENT', name: 'Main Account' }

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => mocks.selectedAccount,
    useAccountBalancesInvalidator: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardInternalWalletsQuery: () => ({
            usdcWallet: mocks.usdcWallet,
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
    }
})

vi.mock('../../../components/CardWithdrawConfirmationSheet', () => ({
    CardWithdrawConfirmationSheet: () => null,
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
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { useCardWithdrawScreen } from '../useCardWithdrawScreen'

const type = (
    result: { current: ReturnType<typeof useCardWithdrawScreen> },
    keys: string[],
) => keys.forEach(key => act(() => result.current.handleKey(key)))

describe('useCardWithdrawScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.usdcWallet = usdcWallet
        mocks.selectedAccount = account
        mocks.isFocused = true
    })

    it('shows the card USDC balance and destination account', () => {
        const { result } = renderHook(() => useCardWithdrawScreen())

        expect(result.current.balanceDisplay).toBe('150.00')
        expect(result.current.destinationAccount?.address).toBe(
            'ALGO_RECIPIENT',
        )
    })

    it('guards decimal input: single separator, leading zero, capped decimals', () => {
        const { result } = renderHook(() => useCardWithdrawScreen())

        type(result, ['.'])
        expect(result.current.amount).toBe('0.')

        type(result, ['.'])
        expect(result.current.amount).toBe('0.')

        type(result, ['1', '2', '3', '4', '5', '6', '7'])
        expect(result.current.amount).toBe('0.123456')

        act(() => result.current.handleKey())
        expect(result.current.amount).toBe('0.12345')
    })

    it('enables Withdraw only for a positive amount within the card balance', () => {
        const { result } = renderHook(() => useCardWithdrawScreen())

        expect(result.current.isWithdrawDisabled).toBe(true)

        type(result, ['5'])
        expect(result.current.isWithdrawDisabled).toBe(false)

        type(result, ['0', '0', '0'])
        expect(result.current.amount).toBe('5000')
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('keeps Withdraw disabled without a USDC wallet', () => {
        mocks.usdcWallet = null

        const { result } = renderHook(() => useCardWithdrawScreen())

        type(result, ['5'])
        expect(result.current.balanceDisplay).toBe('0.00')
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('keeps Withdraw disabled without a destination account', () => {
        mocks.selectedAccount = null

        const { result } = renderHook(() => useCardWithdrawScreen())

        type(result, ['5'])
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('opens the confirmation sheet and finishes on confirm', async () => {
        mockRequestSheet.mockResolvedValue('confirm')

        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockSuccessToast).toHaveBeenCalled())
        expect(mockRequestSheet).toHaveBeenCalledWith(
            expect.objectContaining({
                options: { size: 'auto', enablePanDownToClose: true },
            }),
        )
        expect(mockInvalidate).toHaveBeenCalled()
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('ignores a second Withdraw tap while the sheet request is in flight', async () => {
        let resolveSheet: (value: unknown) => void = () => undefined
        mockRequestSheet.mockImplementation(
            () => new Promise(resolve => (resolveSheet = resolve)),
        )

        const { result } = renderHook(() => useCardWithdrawScreen())
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

        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockSuccessToast).toHaveBeenCalled())
        expect(mockInvalidate).toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('does nothing when the sheet is dismissed', async () => {
        mockRequestSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['2', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockRequestSheet).toHaveBeenCalled())
        expect(mockSuccessToast).not.toHaveBeenCalled()
        expect(mockInvalidate).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
