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
import {
    useAssetPricesQuery,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { SwapQuoteFailure } from '@perawallet/wallet-core-swaps'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { formatSwapLimit } from '@modules/swap/utils/formatSwapLimit'
import { useSwapFiatText } from '@modules/swap/hooks/useSwapFiatText'

export type UseSwapQuoteErrorParams = {
    failure: SwapQuoteFailure
    scope: ChainScope
    payAssetId: string
    receiveScope: ChainScope
    receiveAssetId: string
    /** The account can't reach the minimum even with everything it can spend. */
    isMinimumAboveSpendable?: boolean
}

type UseSwapQuoteErrorResult = {
    message: string
    canRetry: boolean
}

const labelOf = (asset: Optional<PeraAsset>, assetId: string): string =>
    asset?.unitName ?? asset?.name ?? assetId

type LimitParams = { limit: string; unit: string }

export const useSwapQuoteError = ({
    failure,
    scope,
    payAssetId,
    receiveScope,
    receiveAssetId,
    isMinimumAboveSpendable = false,
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
    const { data: payPrices } = useAssetPricesQuery(
        scope,
        [payAssetId],
        failure.kind === 'amount-too-low' && failure.minimum !== null,
    )
    const toFiatText = useSwapFiatText(scope)
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
                  limit: formatSwapLimit(
                      limit,
                      payAsset.decimals,
                      rounding,
                      currentLanguage,
                  ),
                  unit: labelOf(payAsset, payAssetId),
              }

    // Rounded up like the token amount, so the fiat never reads below the floor.
    // A zero price is an unpriced token, not a free one.
    const minimumFiat = (minimum: Decimal): Nullable<string> => {
        const usdPrice = payPrices?.get(payAssetId)?.usdPrice
        if (!payAsset || !usdPrice?.greaterThan(0)) return null
        return toFiatText(
            baseUnitsToDisplayUnits(minimum, payAsset.decimals).mul(usdPrice),
            Decimal.ROUND_UP,
        )
    }

    const resolveMessage = (): string => {
        switch (failure.kind) {
            case 'amount-too-low': {
                const limit = limitParams(failure.minimum, Decimal.ROUND_UP)
                if (!limit || !failure.minimum) {
                    return t('swap.quote.amount_too_low_unknown', { network })
                }
                if (isMinimumAboveSpendable) {
                    return t('swap.quote.amount_too_low_above_balance', {
                        network,
                        amount: limit.limit,
                        unit: limit.unit,
                    })
                }
                const fiat = minimumFiat(failure.minimum)
                return fiat
                    ? t('swap.quote.amount_too_low_fiat', {
                          network,
                          amount: limit.limit,
                          unit: limit.unit,
                          fiat,
                      })
                    : t('swap.quote.amount_too_low', {
                          network,
                          amount: limit.limit,
                          unit: limit.unit,
                      })
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
