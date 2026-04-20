/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Decimal } from 'decimal.js'
import {
    CurrencyDisplay,
    type CurrencyDisplayProps,
} from '@components/CurrencyDisplay'
import { usePreferredCurrencyDisplay } from './usePreferredCurrencyDisplay'
import type { Maybe } from '@perawallet/wallet-core-shared'

export type PreferredCurrencyDisplayProps = {
    sourceAmount: Maybe<Decimal>
    sourceAssetId: string
    forceFallback?: boolean
    usdPrice?: Decimal
} & Omit<CurrencyDisplayProps, 'currency' | 'value'>

export const PreferredCurrencyDisplay = (
    props: PreferredCurrencyDisplayProps,
) => {
    const {
        sourceAmount,
        sourceAssetId,
        forceFallback,
        usdPrice,
        ...displayProps
    } = props
    const { displayCurrency, convertedValue, isPending } =
        usePreferredCurrencyDisplay(
            sourceAmount,
            sourceAssetId,
            forceFallback,
            usdPrice,
        )

    return (
        <CurrencyDisplay
            currency={displayCurrency}
            value={convertedValue}
            isLoading={isPending || displayProps.isLoading}
            {...displayProps}
        />
    )
}
