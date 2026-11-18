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
import type { SwapQuoteFailure } from '@perawallet/wallet-core-swaps'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'

type UseSwapMinimumParams = {
    /** Base units of the pay asset; null until the router names one for the pair. */
    pairMinimum: Nullable<Decimal>
    quoteFailure: Nullable<SwapQuoteFailure>
    /** Base units of the pay asset; null while unknown. */
    spendableMax: Nullable<Decimal>
    payDecimals: number
    /** Receives the minimum in display units. */
    onFillMinimum: (amount: Decimal) => void
}

type UseSwapMinimumResult = {
    /**
     * Lifts a fill (base units) under the router's last floor up to it when
     * the account can afford it. Otherwise the fill stands and the router
     * answers with its current floor: the stored one may be stale.
     */
    liftToMinimum: (amount: Decimal) => Decimal
    /** The router refused the amount as too small, named a minimum, and the account can spend at least that. */
    canUseMinimum: boolean
    handleUseMinimum: () => void
}

export const useSwapMinimum = ({
    pairMinimum,
    quoteFailure,
    spendableMax,
    payDecimals,
    onFillMinimum,
}: UseSwapMinimumParams): UseSwapMinimumResult => {
    const isAffordable =
        pairMinimum !== null &&
        (spendableMax === null ||
            spendableMax.greaterThanOrEqualTo(pairMinimum))

    const liftToMinimum = useCallback(
        (amount: Decimal): Decimal =>
            pairMinimum && isAffordable && amount.lessThan(pairMinimum)
                ? pairMinimum
                : amount,
        [pairMinimum, isAffordable],
    )

    const handleUseMinimum = useCallback(() => {
        if (!pairMinimum) return
        onFillMinimum(baseUnitsToDisplayUnits(pairMinimum, payDecimals))
    }, [pairMinimum, payDecimals, onFillMinimum])

    return {
        liftToMinimum,
        // A refusal that names no floor shows the no-minimum copy, so it gets no button either.
        canUseMinimum:
            quoteFailure?.kind === 'amount-too-low' &&
            quoteFailure.minimum !== null &&
            isAffordable,
        handleUseMinimum,
    }
}
