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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { useOnrampPaymentMethodContent } from '../useOnrampPaymentMethodContent'

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mocks.resolve }),
}))

const quote = (id: string, name: string): RampQuote =>
    ({ paymentMethod: { id, name } }) as RampQuote

describe('useOnrampPaymentMethodContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows each payment method once, however many providers offer it', () => {
        const { result } = renderHook(() =>
            useOnrampPaymentMethodContent({
                quotes: [quote('card', 'Card'), quote('card', 'Card')],
                selectedPaymentMethodId: null,
            }),
        )

        expect(result.current.paymentMethods).toEqual([
            { id: 'card', name: 'Card' },
        ])
    })

    it('resolves the payment method the user picked', () => {
        const { result } = renderHook(() =>
            useOnrampPaymentMethodContent({
                quotes: [quote('card', 'Card'), quote('bank', 'Bank')],
                selectedPaymentMethodId: null,
            }),
        )

        act(() => result.current.selectPaymentMethod('bank'))
        act(() => result.current.handleApply())

        expect(mocks.resolve).toHaveBeenCalledWith('bank')
    })
})
