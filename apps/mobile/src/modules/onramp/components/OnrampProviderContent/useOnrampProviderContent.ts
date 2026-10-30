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

import { useCallback, useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import {
    filterQuotesByPaymentMethod,
    pickBestQuote,
    sortQuotesByDestinationDesc,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseOnrampProviderContentProps = {
    quotes: RampQuote[]
    /** Display units; XO destination amounts are computed from it. */
    sourceAmount: Nullable<Decimal>
    selectedPaymentMethodId: Nullable<string>
}

export type UseOnrampProviderContentResult = {
    sortedQuotes: RampQuote[]
    bestQuoteId: Nullable<string>
    handleSelect: (quoteId: string) => void
}

export const useOnrampProviderContent = ({
    quotes,
    sourceAmount,
    selectedPaymentMethodId,
}: UseOnrampProviderContentProps): UseOnrampProviderContentResult => {
    const { resolve } = useBottomSheetResult<string>()

    // Providers are compared within one payment method: quotes on different
    // rails price differently, and every provider quotes each rail it supports.
    const methodQuotes = useMemo(
        () => filterQuotesByPaymentMethod(quotes, selectedPaymentMethodId),
        [quotes, selectedPaymentMethodId],
    )

    const sortedQuotes = useMemo(
        () => sortQuotesByDestinationDesc(methodQuotes, sourceAmount),
        [methodQuotes, sourceAmount],
    )
    const bestQuoteId = useMemo(
        () => pickBestQuote(methodQuotes, sourceAmount)?.quoteId,
        [methodQuotes, sourceAmount],
    )

    const handleSelect = useCallback(
        (quoteId: string) => {
            resolve(quoteId)
        },
        [resolve],
    )

    return {sortedQuotes, bestQuoteId, handleSelect}
}
