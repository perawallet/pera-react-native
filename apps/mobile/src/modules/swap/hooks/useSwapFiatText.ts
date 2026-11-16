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
import type { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useLocalCurrency } from '@perawallet/wallet-core-currencies'
import { formatCurrency, type Nullable } from '@perawallet/wallet-core-shared'
import { resolvePrecision } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'

/** Formats a USD value in the user's fiat for use inside a sentence; null until the rate is known. */
export const useSwapFiatText = (
    scope: ChainScope,
): ((usd: Decimal, rounding: Decimal.Rounding) => Nullable<string>) => {
    const { localCurrency, localRate } = useLocalCurrency(scope)
    const { currentLanguage } = useLanguage()

    return useCallback(
        (usd, rounding) => {
            if (!localRate) return null
            const value = usd.mul(localRate)
            const { precision, minPrecision } = resolvePrecision(
                'preferredFull',
                undefined,
                value,
                true,
            )
            return formatCurrency(
                value.toDecimalPlaces(precision, rounding),
                precision,
                localCurrency,
                currentLanguage,
                true,
                minPrecision,
            )
        },
        [localRate, localCurrency, currentLanguage],
    )
}
