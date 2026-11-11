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

import { Decimal } from 'decimal.js'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { SwapQuoteFailure } from '@perawallet/wallet-core-swaps'
import {
    baseUnitsToDisplayUnits,
    formatCurrency,
    resolveAssetDisplayPrecision,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

export type UseSwapQuoteErrorParams = {
    failure: SwapQuoteFailure
    scope: ChainScope
    payAssetId: string
    receiveScope: ChainScope
    receiveAssetId: string
}

type UseSwapQuoteErrorResult = {
    message: string
    canRetry: boolean
}

const labelOf = (asset: Optional<PeraAsset>, assetId: string): string =>
    asset?.unitName ?? asset?.name ?? assetId

type LimitParams = { limit: string; unit: string }

// A minimum rounds up and a maximum down, so the limit shown is one the
// router accepts.
const formatLimit = (
    limit: Decimal,
    decimals: number,
    rounding: Decimal.Rounding,
    locale: string,
): string => {
    const display = baseUnitsToDisplayUnits(limit, decimals)
    const precision = resolveAssetDisplayPrecision(display, decimals)
    return formatCurrency(
        display.toDecimalPlaces(precision, rounding),
        precision,
        '',
        locale,
        false,
        0,
    )
}

export const useSwapQuoteError = ({
    failure,
    scope,
    payAssetId,
    receiveScope,
    receiveAssetId,
}: UseSwapQuoteErrorParams): UseSwapQuoteErrorResult => {
    const { t, currentLanguage } = useLanguage()
    const { data: payAssets } = useAssetsQuery(scope, [payAssetId], {
        fetchMissing: true,
    })
    const { data: receiveAssets } = useAssetsQuery(
        receiveScope,
        [receiveAssetId],
        { fetchMissing: true },
    )
    const payAsset: Optional<PeraAsset> = payAssets.get(payAssetId)
    const receiveAsset: Optional<PeraAsset> = receiveAssets.get(receiveAssetId)
    const network = chainDisplayNameOf(scope.chainId) ?? ''

    const limitParams = (
        limit: Nullable<Decimal>,
        rounding: Decimal.Rounding,
    ): Nullable<LimitParams> =>
        limit === null || !payAsset
            ? null
            : {
                  limit: formatLimit(
                      limit,
                      payAsset.decimals,
                      rounding,
                      currentLanguage,
                  ),
                  unit: labelOf(payAsset, payAssetId),
              }

    const resolveMessage = (): string => {
        switch (failure.kind) {
            case 'amount-too-low': {
                const limit = limitParams(failure.minimum, Decimal.ROUND_UP)
                return limit
                    ? t('swap.quote.amount_too_low', {
                          network,
                          amount: limit.limit,
                          unit: limit.unit,
                      })
                    : t('swap.quote.amount_too_low_unknown', { network })
            }
            case 'amount-too-high': {
                const limit = limitParams(failure.maximum, Decimal.ROUND_DOWN)
                return limit
                    ? t('swap.quote.amount_too_high', {
                          amount: limit.limit,
                          unit: limit.unit,
                      })
                    : t('swap.quote.amount_too_high_unknown')
            }
            case 'invalid-amount': {
                return t('swap.quote.amount_invalid')
            }
            case 'no-route': {
                return t('swap.quote.no_route', {
                    from: labelOf(payAsset, payAssetId),
                    to: labelOf(receiveAsset, receiveAssetId),
                })
            }
            case 'unsupported': {
                return t('swap.quote.unsupported')
            }
            case 'restricted': {
                return t('swap.quote.restricted')
            }
            case 'network-unavailable': {
                return t('swap.quote.network_unavailable', { network })
            }
            case 'unavailable': {
                return t('swap.quote.quote_error')
            }
        }
    }

    return {
        message: resolveMessage(),
        canRetry: failure.kind === 'unavailable',
    }
}
