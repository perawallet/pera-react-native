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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { PWSkeleton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { formatNumber } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'

export type SwapQuoteDetailsProps = {
    quote: SwapQuote
    isLoading?: boolean
}

const PRICE_IMPACT_LOW_THRESHOLD = new Decimal(1)
const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

export const SwapQuoteDetails = ({
    quote,
    isLoading,
}: SwapQuoteDetailsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const priceImpactStyle = useMemo(() => {
        if (!quote.priceImpact) return styles.value
        if (quote.priceImpact.lessThan(PRICE_IMPACT_LOW_THRESHOLD))
            return styles.priceImpactLow
        if (quote.priceImpact.lessThan(PRICE_IMPACT_HIGH_THRESHOLD))
            return styles.priceImpactMedium
        return styles.priceImpactHigh
    }, [quote.priceImpact, styles])

    const formattedPeraFee = useMemo(() => {
        if (!quote.peraFeeAmount) return '-'
        return formatAssetAmount(quote.peraFeeAmount, quote.assetIn)
    }, [quote.peraFeeAmount, quote.assetIn])

    const formattedExchangeFee = useMemo(() => {
        if (!quote.exchangeFeeAmount) return '-'
        return formatAssetAmount(quote.exchangeFeeAmount, quote.assetIn)
    }, [quote.exchangeFeeAmount, quote.assetIn])

    const rateDisplay = useMemo(() => {
        if (!quote.price) return '-'
        const outDecimals = quote.assetOut.decimals ?? 6
        const { sign, integer, fraction } = formatNumber(
            quote.price,
            outDecimals,
            undefined,
            2,
        )
        return `1 ${quote.assetIn.unitName ?? ''} ≈ ${sign}${integer}${fraction} ${quote.assetOut.unitName ?? ''}`
    }, [quote.price, quote.assetIn, quote.assetOut])

    return (
        <PWView
            style={styles.container}
            testID='swap-quote-details'
        >
            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.rate')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={140}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {rateDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.price_impact')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={60}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={priceImpactStyle}
                    >
                        {quote.priceImpact
                            ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                            : '-'}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.slippage_tolerance')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={50}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {quote.slippage ? `${quote.slippage.toString()}%` : '-'}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.pera_fee')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={80}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {formattedPeraFee}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.exchange_fee')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={80}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {formattedExchangeFee}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.provider')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={70}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {quote.provider ?? '-'}
                    </PWText>
                )}
            </PWView>
        </PWView>
    )
}
