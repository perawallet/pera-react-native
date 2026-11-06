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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    RampDepositInstructions,
    RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import {
    makeAlgoToken,
    makeDepositToken,
    makeFiatToken,
    makeRampPair,
} from '@test-utils/rampFixtures'
import { useOnrampOrderDetails } from '../useOnrampOrderDetails'

const mocks = vi.hoisted(() => ({
    cancelOrder: vi.fn(),
    requestBottomSheet: vi.fn(),
    dismiss: vi.fn(),
    successToast: vi.fn(),
    errorToast: vi.fn(),
    remembered: null as RampDepositInstructions | null,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

vi.mock('@perawallet/wallet-core-onramp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-onramp')
    >()),
    useCancelRampOrderMutation: () => ({
        mutateAsync: mocks.cancelOrder,
        isPending: false,
    }),
    useRampDepositInstructions: () => mocks.remembered,
}))

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({
        account: null,
        scope: SCOPE,
        address: 'ACCOUNT_ADDRESS',
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
    useBottomSheetResult: () => ({ dismiss: mocks.dismiss }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mocks.successToast,
        errorToast: mocks.errorToast,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

const item = (overrides: Partial<RampHistoryItem> = {}): RampHistoryItem => ({
    id: 'order-1',
    kind: 'xo',
    status: 'pending',
    creationDatetime: '2025-06-01T10:00:00Z',
    provider: 'XO',
    pair: makeRampPair(makeDepositToken(), makeAlgoToken()),
    sourceAmount: new Decimal('0.5'),
    destinationAmount: new Decimal(950),
    ...overrides,
})

describe('useOnrampOrderDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.remembered = null
        mocks.requestBottomSheet.mockResolvedValue(true)
        mocks.cancelOrder.mockResolvedValue(undefined)
    })

    it('shows the pay-in address and memo this device remembered for a pending deposit order', () => {
        mocks.remembered = { address: 'PAYIN', memo: '42' }

        const { result } = renderHook(() => useOnrampOrderDetails(item()))

        expect(result.current.isXo).toBe(true)
        expect(result.current.isPendingXo).toBe(true)
        expect(result.current.payInAddress).toBe('PAYIN')
        expect(result.current.payInAddressTag).toBe('42')
    })

    it('reads a legacy order with no funding method as XO by its provider', () => {
        const { result } = renderHook(() =>
            useOnrampOrderDetails(item({ kind: null, provider: 'xo' })),
        )

        expect(result.current.isXo).toBe(true)
    })

    it("prefers the item's own pay-in details over the remembered ones", () => {
        mocks.remembered = { address: 'OLD', memo: null }

        const { result } = renderHook(() =>
            useOnrampOrderDetails(
                item({ payInAddress: 'FRESH', payInAddressTag: '7' }),
            ),
        )

        expect(result.current.payInAddress).toBe('FRESH')
        expect(result.current.payInAddressTag).toBe('7')
    })

    it('has no pay-in address, and so no cancel card, without remembered instructions', () => {
        const { result } = renderHook(() => useOnrampOrderDetails(item()))

        expect(result.current.payInAddress).toBeNull()
        expect(result.current.isPendingXo).toBe(false)
    })

    it('offers no pay-in card once the order is no longer pending', () => {
        mocks.remembered = { address: 'PAYIN', memo: null }

        const { result } = renderHook(() =>
            useOnrampOrderDetails(item({ status: 'completed' })),
        )

        expect(result.current.isPendingXo).toBe(false)
    })

    it('treats a provider checkout order as no XO order', () => {
        const { result } = renderHook(() =>
            useOnrampOrderDetails(
                item({
                    kind: 'meld',
                    provider: 'BANXA',
                    pair: makeRampPair(makeFiatToken('EUR'), makeAlgoToken()),
                }),
            ),
        )

        expect(result.current.isXo).toBe(false)
        expect(result.current.contactOrderId).toBe('order-1')
    })

    it('cancels by the item id once confirmed, and closes the sheet', async () => {
        const { result } = renderHook(() => useOnrampOrderDetails(item()))

        await act(() => result.current.handleCancelOrder())

        expect(mocks.cancelOrder).toHaveBeenCalledWith({
            scope: SCOPE,
            orderId: 'order-1',
        })
        expect(mocks.dismiss).toHaveBeenCalled()
        expect(mocks.successToast).toHaveBeenCalledWith(
            '',
            'onramp.order_review.cancel_success',
        )
    })

    it('does not cancel when the user keeps the order', async () => {
        mocks.requestBottomSheet.mockResolvedValue(false)
        const { result } = renderHook(() => useOnrampOrderDetails(item()))

        await act(() => result.current.handleCancelOrder())

        expect(mocks.cancelOrder).not.toHaveBeenCalled()
    })

    it('does not cancel an order that is not pending', async () => {
        const { result } = renderHook(() =>
            useOnrampOrderDetails(item({ status: 'completed' })),
        )

        await act(() => result.current.handleCancelOrder())

        expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        expect(mocks.cancelOrder).not.toHaveBeenCalled()
    })

    it("shows the router's message in an error toast when the cancel is refused", async () => {
        mocks.cancelOrder.mockRejectedValue({
            name: 'HTTPError',
            status: 409,
            data: {
                error: 'The order cannot be cancelled.',
                code: 'invalid_status_transition',
            },
        })
        const { result } = renderHook(() => useOnrampOrderDetails(item()))

        await act(() => result.current.handleCancelOrder())

        expect(mocks.errorToast).toHaveBeenCalledWith(
            '',
            'The order cannot be cancelled.',
        )
        expect(mocks.dismiss).not.toHaveBeenCalled()
    })
})
