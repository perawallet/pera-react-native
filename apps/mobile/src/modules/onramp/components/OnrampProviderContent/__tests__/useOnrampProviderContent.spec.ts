/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { useOnrampProviderContent } from '../useOnrampProviderContent'

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mocks.resolve }),
}))

const quote = (quoteId: string, paymentMethodId: string): RampQuote =>
    ({
        quoteId,
        paymentMethod: { id: paymentMethodId, name: paymentMethodId },
        destinationAmount: new Decimal(100),
    }) as unknown as RampQuote

describe('useOnrampProviderContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists only the quotes of the selected payment method', () => {
        const { result } = renderHook(() =>
            useOnrampProviderContent({
                quotes: [quote('a', 'card'), quote('b', 'bank')],
                sourceAmount: new Decimal(1),
                selectedPaymentMethodId: 'card',
            }),
        )

        expect(result.current.sortedQuotes.map((q) => q.quoteId)).toEqual(['a'])
    })

    it('resolves the quote the user picked', () => {
        const { result } = renderHook(() =>
            useOnrampProviderContent({
                quotes: [quote('a', 'card')],
                sourceAmount: new Decimal(1),
                selectedPaymentMethodId: null,
            }),
        )

        act(() => result.current.handleSelect('a'))

        expect(mocks.resolve).toHaveBeenCalledWith('a')
    })
})
