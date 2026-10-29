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

import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { usePreferredAmount } from '../usePreferredAmount'
import { displayCurrencyToAssetId } from '@perawallet/wallet-core-assets'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { isFiatCurrency, precisionFor } from '../preferredAmountDisplay'
import type { ConvertedPreferredAmountProps } from '../types'

export const ConvertedPreferredAmount = ({
    sourceAmount,
    sourceAssetId,
    forceFallback,
    usdPrice,
    scope,
    density = 'detailed',
    ...displayProps
}: ConvertedPreferredAmountProps) => {
    const currencyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const { displayCurrency, convertedValue, isPending } = usePreferredAmount(
        sourceAmount,
        sourceAssetId,
        forceFallback,
        usdPrice,
        scope,
    )
    // The preferred/fallback currency is a settings value, so its ALGO ticker is
    // trusted — translate it into the id-keyed identity.
    const displayAssetId = displayCurrencyToAssetId(
        displayCurrency,
        currencyScope.chainId,
    )

    return (
        <CurrencyAmount
            currency={displayCurrency}
            assetId={displayAssetId}
            isFiat={isFiatCurrency(displayAssetId)}
            value={convertedValue}
            {...displayProps}
            isLoading={isPending || displayProps.isLoading}
            precision={precisionFor(density)}
        />
    )
}
