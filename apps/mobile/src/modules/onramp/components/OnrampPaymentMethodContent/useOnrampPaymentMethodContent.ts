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

import { useCallback, useMemo, useState } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RampQuote } from '@perawallet/wallet-core-onramp'

export type OnrampPaymentMethodContentProps = {
    quotes: RampQuote[]
    selectedPaymentMethodId: Nullable<string>
}

type PaymentMethodOption = {
    id: string
    name: string
}

// Quotes can repeat payment methods across providers; show each method once.
const distinctPaymentMethods = (quotes: RampQuote[]): PaymentMethodOption[] => {
    const seen = new Set<string>()
    const methods: PaymentMethodOption[] = []
    for (const quote of quotes) {
        const { id, name } = quote.paymentMethod
        if (seen.has(id)) continue
        seen.add(id)
        methods.push({ id, name })
    }
    return methods
}

export type UseOnrampPaymentMethodContentResult = {
    paymentMethods: PaymentMethodOption[]
    highlightedId: Nullable<string>
    selectPaymentMethod: (id: string) => void
    handleApply: () => void
}

export const useOnrampPaymentMethodContent = ({
    quotes,
    selectedPaymentMethodId,
}: OnrampPaymentMethodContentProps): UseOnrampPaymentMethodContentResult => {
    const { resolve } = useBottomSheetResult<string>()

    const paymentMethods = useMemo(
        () => distinctPaymentMethods(quotes),
        [quotes],
    )

    const [highlightedId, setHighlightedId] = useState<Nullable<string>>(
        selectedPaymentMethodId ?? paymentMethods[0]?.id ?? null,
    )

    const selectPaymentMethod = useCallback((id: string) => {
        setHighlightedId(id)
    }, [])

    const handleApply = useCallback(() => {
        if (highlightedId) {
            resolve(highlightedId)
        }
    }, [highlightedId, resolve])

    return {
        paymentMethods,
        highlightedId,
        selectPaymentMethod,
        handleApply,
    }
}
