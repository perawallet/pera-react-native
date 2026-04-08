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
import {
    PWBottomSheet,
    PWButton,
    PWDivider,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { formatNumber } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'

export type SwapConfirmationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onConfirm: () => void
    quote: SwapQuote | null
    isConfirming?: boolean
}

const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

export const SwapConfirmationBottomSheet = ({
    isVisible,
    onClose,
    onConfirm,
    quote,
    isConfirming,
}: SwapConfirmationBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const payDisplay = useMemo(() => {
        if (!quote?.amountIn) return '-'
        return formatAssetAmount(quote.amountIn, quote.assetIn)
    }, [quote?.amountIn, quote?.assetIn])

    const receiveDisplay = useMemo(() => {
        if (!quote?.amountOut) return '-'
        return formatAssetAmount(quote.amountOut, quote.assetOut)
    }, [quote?.amountOut, quote?.assetOut])

    const rateDisplay = useMemo(() => {
        if (!quote?.price) return '-'
        const outDecimals = quote.assetOut.decimals ?? 6
        const { sign, integer, fraction } = formatNumber(
            quote.price,
            outDecimals,
            undefined,
            2,
        )
        return `1 ${quote.assetIn.unitName ?? ''} ≈ ${sign}${integer}${fraction} ${quote.assetOut.unitName ?? ''}`
    }, [quote?.price, quote?.assetIn, quote?.assetOut])

    const formattedPeraFee = useMemo(() => {
        if (!quote?.peraFeeAmount) return '-'
        return formatAssetAmount(quote.peraFeeAmount, quote.assetIn)
    }, [quote?.peraFeeAmount, quote?.assetIn])

    const formattedExchangeFee = useMemo(() => {
        if (!quote?.exchangeFeeAmount) return '-'
        return formatAssetAmount(quote.exchangeFeeAmount, quote.assetIn)
    }, [quote?.exchangeFeeAmount, quote?.assetIn])

    const hasHighPriceImpact = useMemo(
        () =>
            quote?.priceImpact?.greaterThanOrEqualTo(
                PRICE_IMPACT_HIGH_THRESHOLD,
            ) ?? false,
        [quote?.priceImpact],
    )

    const priceImpactStyle = useMemo(() => {
        if (!quote?.priceImpact) return styles.detailValue
        if (quote.priceImpact.lessThan(1)) return styles.priceImpactLow
        if (quote.priceImpact.lessThan(PRICE_IMPACT_HIGH_THRESHOLD))
            return styles.priceImpactMedium
        return styles.priceImpactHigh
    }, [quote?.priceImpact, styles])

    if (!quote) return null

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='lg'
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={onClose}
                            testID='swap-confirm-close'
                        />
                    }
                    center={
                        <PWText variant='h4'>
                            {t('swap.quote.review_swap')}
                        </PWText>
                    }
                    paddingStyle='dense'
                />

                <PWView style={styles.summarySection}>
                    <PWText
                        variant='caption'
                        style={styles.summaryLabel}
                    >
                        {t('swap.form.you_pay')}
                    </PWText>
                    <PWText
                        variant='h3'
                        style={styles.summaryAmount}
                    >
                        {payDisplay}
                    </PWText>

                    <PWView style={styles.arrowContainer}>
                        <PWIcon
                            name='arrow-down'
                            size='sm'
                        />
                    </PWView>

                    <PWText
                        variant='caption'
                        style={styles.summaryLabel}
                    >
                        {t('swap.form.you_receive')}
                    </PWText>
                    <PWText
                        variant='h3'
                        style={styles.summaryAmount}
                    >
                        {receiveDisplay}
                    </PWText>
                </PWView>

                <PWDivider />

                <PWView style={styles.detailsSection}>
                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.rate')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.detailValue}
                        >
                            {rateDisplay}
                        </PWText>
                    </PWView>

                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.price_impact')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={priceImpactStyle}
                        >
                            {quote.priceImpact
                                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                                : '-'}
                        </PWText>
                    </PWView>

                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.slippage_tolerance')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.detailValue}
                        >
                            {quote.slippage
                                ? `${quote.slippage.toString()}%`
                                : '-'}
                        </PWText>
                    </PWView>

                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.pera_fee')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.detailValue}
                        >
                            {formattedPeraFee}
                        </PWText>
                    </PWView>

                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.exchange_fee')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.detailValue}
                        >
                            {formattedExchangeFee}
                        </PWText>
                    </PWView>

                    <PWView style={styles.detailRow}>
                        <PWText
                            variant='body'
                            style={styles.detailLabel}
                        >
                            {t('swap.quote.provider')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.detailValue}
                        >
                            {quote.provider ?? '-'}
                        </PWText>
                    </PWView>
                </PWView>

                {hasHighPriceImpact && (
                    <PWView
                        style={styles.warningBanner}
                        testID='swap-confirm-warning'
                    >
                        <PWText
                            variant='body'
                            style={styles.warningText}
                        >
                            {t('swap.quote.high_price_impact_warning')}
                        </PWText>
                    </PWView>
                )}

                <PWButton
                    variant='primary'
                    title={t('swap.quote.confirm_swap')}
                    onPress={onConfirm}
                    isLoading={isConfirming}
                    style={styles.confirmButton}
                    testID='swap-confirm-button'
                />
            </PWView>
        </PWBottomSheet>
    )
}
