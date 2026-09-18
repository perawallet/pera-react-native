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
const mockRequestSheet = vi.fn()
const mockGoBack = vi.fn()
const mocks = vi.hoisted(() => ({
    cardBalance: '150',
    owner: null as unknown,
    pending: null as unknown,
    isFocused: true,
}))

const owner = { address: 'OWNER', name: 'Main Account' }

vi.mock('../../../hooks', () => ({
    useCardEscrowBalance: () => ({
        balance: new Decimal(mocks.cardBalance),
        isLoading: false,
    }),
    useCardOwnerAccount: () => mocks.owner,
}))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardPendingWithdrawalQuery: () => ({
        pending: mocks.pending,
        waitTimeSeconds: 20,
        isLoading: false,
        invalidate: vi.fn(),
    }),
}))

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

import { useCardWithdrawScreen } from '../useCardWithdrawScreen'

const type = (
    result: { current: ReturnType<typeof useCardWithdrawScreen> },
    keys: string[],
) => {
    for (const key of keys) act(() => result.current.handleKey(key))
}

describe('useCardWithdrawScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.cardBalance = '150'
        mocks.owner = owner
        mocks.pending = null
        mocks.isFocused = true
    })

    it("shows the escrow card balance and withdraws to the card's owner", () => {
        const { result } = renderHook(() => useCardWithdrawScreen())

        expect(result.current.balanceDisplay).toBe('150.00')
        expect(result.current.destinationAccount).toBe(owner)
    })

    it('enables Withdraw only for a positive amount within the card balance', () => {
        const { result } = renderHook(() => useCardWithdrawScreen())
        expect(result.current.isWithdrawDisabled).toBe(true)

        type(result, ['5'])
        expect(result.current.isWithdrawDisabled).toBe(false)

        type(result, ['0', '0'])
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('stays disabled when the owner account is gone from the wallet', () => {
        mocks.owner = null
        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['5'])

        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    // The contract holds one request per card, so a second one has to wait.
    it('blocks a new request while one is still pending', () => {
        mocks.pending = { amount: 100_000n }
        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['5'])

        expect(result.current.hasPendingWithdrawal).toBe(true)
        expect(result.current.isWithdrawDisabled).toBe(true)
    })

    it('toasts the requested amount, then leaves, once the sheet confirms', async () => {
        mockRequestSheet.mockResolvedValue('confirm')
        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['2', '.', '5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
        expect(mockSuccessToast).toHaveBeenCalledWith(
            'peraCard.withdraw.requested_title',
            'peraCard.withdraw.requested_body',
        )
    })

    it('does nothing further when the sheet is dismissed', async () => {
        mockRequestSheet.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardWithdrawScreen())
        type(result, ['5'])

        act(() => result.current.onWithdraw())

        await waitFor(() => expect(mockRequestSheet).toHaveBeenCalled())
        expect(mockSuccessToast).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
