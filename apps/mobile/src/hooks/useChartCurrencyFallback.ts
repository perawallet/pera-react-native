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

import { useCallback } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

export type UseChartCurrencyFallbackResult = {
    /** The history's own failure, or the rate its values are converted with being unavailable. */
    isError: boolean
    /** Names the currency; `undefined` leaves the chart's generic error copy. */
    errorBody: Optional<string>
    /** Asks again for whichever of the rate and the history failed. */
    onRetry: () => void
}

export const useChartCurrencyFallback = (
    scope: ChainScope,
    history: { isError: boolean; refetch: () => unknown },
): UseChartCurrencyFallbackResult => {
    const { t } = useLanguage()
    const { preferredCurrency, isRateUnavailable, refetchRate } =
        useCurrency(scope)
    const { isError, refetch } = history

    const onRetry = useCallback(() => {
        if (isRateUnavailable) refetchRate()
        if (isError) void refetch()
    }, [isRateUnavailable, refetchRate, isError, refetch])

    return {
        isError: isError || isRateUnavailable,
        errorBody: isRateUnavailable
            ? t('common.wealth_chart.currency_unavailable_body', {
                  currency: preferredCurrency,
              })
            : undefined,
        onRetry,
    }
}
