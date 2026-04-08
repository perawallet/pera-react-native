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
import { formatCurrency, formatNumber } from '@perawallet/wallet-core-shared'
import { CurrencyDisplay } from '@components/CurrencyDisplay/CurrencyDisplay'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { InfoButton } from '@components/InfoButton/InfoButton'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import type { SwapExecutionStatus } from '../../hooks/useSwapExecution'
import { useStyles } from './styles'

export type SwapConfirmationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onConfirm: () => void
    quote: SwapQuote | null
    swapStatus: SwapExecutionStatus
}

const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

export const SwapConfirmationBottomSheet = ({
    isVisible,
    onClose,
    onConfirm,
    quote,
    swapStatus,
}: SwapConfirmationBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()

    const assetInId = quote?.assetIn.assetId?.toString()
    const assetOutId = quote?.assetOut.assetId?.toString()
    const { data: inAssets } = useAssetsQuery(assetInId ? [assetInId] : [])
    const { data: outAssets } = useAssetsQuery(assetOutId ? [assetOutId] : [])
    const inAsset = assetInId ? inAssets?.get(assetInId) : undefined
    const outAsset = assetOutId ? outAssets?.get(assetOutId) : undefined

    const isProcessing =
        swapStatus === 'preparing' ||
        swapStatus === 'signing' ||
        swapStatus === 'submitting' ||
        swapStatus === 'updating-status'

    const buttonTitle = useMemo(() => {
        switch (swapStatus) {
            case 'signing':
                return t('swap.execution.signing')
            case 'submitting':
                return t('swap.execution.submitting')
            case 'updating-status':
                return t('swap.execution.finalizing')
            default:
                return t('swap.quote.confirm_swap')
        }
    }, [swapStatus, t])

    const payDisplay = useMemo(() => {
        if (!quote?.amountIn) return '-'
        return formatAssetAmount(quote.amountIn, quote.assetIn)
    }, [quote?.amountIn, quote?.assetIn])

    const receiveDisplay = useMemo(() => {
        if (!quote?.amountOut) return '-'
        return formatAssetAmount(quote.amountOut, quote.assetOut)
    }, [quote?.amountOut, quote?.assetOut])

    const payUsdDisplay = useMemo(() => {
        if (!quote?.amountInUsdValue) return undefined
        return formatCurrency(quote.amountInUsdValue, 2, 'USD')
    }, [quote?.amountInUsdValue])

    const receiveUsdDisplay = useMemo(() => {
        if (!quote?.amountOutUsdValue) return undefined
        return formatCurrency(quote.amountOutUsdValue, 2, 'USD')
    }, [quote?.amountOutUsdValue])

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

    const minimumReceivedDisplay = useMemo(() => {
        if (!quote?.amountOutWithSlippage) return '-'
        return formatAssetAmount(quote.amountOutWithSlippage, quote.assetOut)
    }, [quote?.amountOutWithSlippage, quote?.assetOut])

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
            onBackdropPress={isProcessing ? undefined : onClose}
            size='lg'
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={isProcessing ? undefined : onClose}
                            testID='swap-confirm-close'
                        />
                    }
                    center={
                        <PWView style={styles.headerCenter}>
                            <PWText variant='h4'>
                                {t('swap.quote.confirm_swap')}
                            </PWText>
                            {selectedAccount && (
                                <PWView style={styles.accountRow}>
                                    <AccountIcon
                                        account={selectedAccount}
                                        size='sm'
                                    />
                                    <PWText
                                        variant='caption'
                                        style={styles.accountName}
                                    >
                                        {selectedAccount.name}
                                    </PWText>
                                </PWView>
                            )}
                        </PWView>
                    }
                    paddingStyle='dense'
                />

                {/* Pay section */}
                <PWView style={styles.assetSection}>
                    <PWView style={styles.assetRow}>
                        <PWView style={styles.assetAmountContainer}>
                            {inAsset && (
                                <AssetIcon
                                    asset={inAsset}
                                    size='lg'
                                />
                            )}
                            <PWView style={styles.amountTextContainer}>
                                <PWText
                                    variant='h2'
                                    style={styles.assetAmount}
                                >
                                    {payDisplay}
                                </PWText>
                                {payUsdDisplay && (
                                    <PWText
                                        variant='caption'
                                        style={styles.usdValue}
                                    >
                                        {payUsdDisplay}
                                    </PWText>
                                )}
                            </PWView>
                        </PWView>
                        <AssetChip
                            unitName={quote.assetIn.unitName}
                            verificationTier={quote.assetIn.verificationTier}
                        />
                    </PWView>
                </PWView>

                {/* TO divider */}
                <PWView style={styles.toDivider}>
                    <PWDivider />
                    <PWText
                        variant='caption'
                        style={styles.toLabel}
                    >
                        {t('swap.form.to')}
                    </PWText>
                    <PWDivider />
                </PWView>

                {/* Receive section */}
                <PWView style={styles.assetSection}>
                    <PWView style={styles.assetRow}>
                        <PWView style={styles.assetAmountContainer}>
                            {outAsset && (
                                <AssetIcon
                                    asset={outAsset}
                                    size='lg'
                                />
                            )}
                            <PWView style={styles.amountTextContainer}>
                                <PWText
                                    variant='h2'
                                    style={styles.assetAmount}
                                >
                                    {receiveDisplay}
                                </PWText>
                                {receiveUsdDisplay && (
                                    <PWText
                                        variant='caption'
                                        style={styles.usdValue}
                                    >
                                        {receiveUsdDisplay}
                                    </PWText>
                                )}
                            </PWView>
                        </PWView>
                        <AssetChip
                            unitName={quote.assetOut.unitName}
                            verificationTier={quote.assetOut.verificationTier}
                        />
                    </PWView>
                </PWView>

                {/* Details section */}
                <PWView style={styles.detailsSection}>
                    <DetailRow label={t('swap.quote.rate')}>
                        <PWView style={styles.rateValueRow}>
                            <PWText
                                variant='body'
                                style={styles.detailValue}
                            >
                                {rateDisplay}
                            </PWText>
                            <PWIcon
                                name='swap'
                                size='xs'
                            />
                        </PWView>
                    </DetailRow>
                    <DetailRow
                        label={t('swap.quote.provider')}
                        value={quote.provider ?? '-'}
                        valueStyle={styles.detailValue}
                    />
                    <DetailRow
                        label={t('swap.quote.slippage_tolerance')}
                        value={
                            quote.slippage
                                ? `${quote.slippage.toString()}%`
                                : '-'
                        }
                        valueStyle={styles.detailValue}
                        info={t('swap.info.slippage_tolerance')}
                    />
                    <DetailRow
                        label={t('swap.quote.price_impact')}
                        value={
                            quote.priceImpact
                                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                                : '-'
                        }
                        valueStyle={priceImpactStyle}
                        info={t('swap.info.price_impact')}
                    />
                    <DetailRow
                        label={t('swap.quote.minimum_received')}
                        value={minimumReceivedDisplay}
                        valueStyle={styles.detailValue}
                    />
                    <DetailRow
                        label={t('swap.quote.exchange_fee')}
                        info={t('swap.info.exchange_fee')}
                    >
                        <CurrencyDisplay
                            currency={
                                quote.assetIn.unitName === 'ALGO'
                                    ? 'ALGO'
                                    : (quote.assetIn.unitName ?? '')
                            }
                            value={quote.exchangeFeeAmount ?? null}
                            precision={quote.assetIn.decimals ?? 6}
                            showSymbol={quote.assetIn.unitName === 'ALGO'}
                            symbolPosition='start'
                            variant='body'
                        />
                    </DetailRow>
                    <DetailRow label={t('swap.quote.pera_fee')}>
                        <CurrencyDisplay
                            currency={
                                quote.assetIn.unitName === 'ALGO'
                                    ? 'ALGO'
                                    : (quote.assetIn.unitName ?? '')
                            }
                            value={quote.peraFeeAmount ?? null}
                            precision={quote.assetIn.decimals ?? 6}
                            showSymbol={quote.assetIn.unitName === 'ALGO'}
                            symbolPosition='start'
                            variant='body'
                        />
                    </DetailRow>
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

                {swapStatus === 'error' && (
                    <PWView
                        style={styles.errorBanner}
                        testID='swap-confirm-error'
                    >
                        <PWText
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('swap.execution.error')}
                        </PWText>
                    </PWView>
                )}

                {/* TODO: Replace with slide-to-confirm component */}
                <PWButton
                    variant='primary'
                    title={buttonTitle}
                    onPress={onConfirm}
                    isLoading={isProcessing}
                    style={styles.confirmButton}
                    testID='swap-confirm-button'
                />
            </PWView>
        </PWBottomSheet>
    )
}

type AssetChipProps = {
    unitName?: string
    verificationTier: string
}

const AssetChip = ({ unitName, verificationTier }: AssetChipProps) => {
    const styles = useStyles()
    const icon = getVerificationIcon(verificationTier)

    return (
        <PWView style={styles.assetChip}>
            <PWText
                variant='body'
                style={styles.assetChipText}
            >
                {unitName ?? ''}
            </PWText>
            {icon && (
                <PWIcon
                    name={icon}
                    size='xs'
                />
            )}
        </PWView>
    )
}

type DetailRowProps = {
    label: string
    value?: string
    valueStyle?: object
    info?: string
    children?: React.ReactNode
}

const DetailRow = ({
    label,
    value,
    valueStyle,
    info,
    children,
}: DetailRowProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.detailRow}>
            <PWView style={styles.detailLabelRow}>
                <PWText
                    variant='body'
                    style={styles.detailLabel}
                >
                    {label}
                </PWText>
                {info && (
                    <InfoButton size='xs'>
                        <PWText variant='body'>{info}</PWText>
                    </InfoButton>
                )}
            </PWView>
            {children ?? (
                <PWText
                    variant='body'
                    style={valueStyle}
                >
                    {value}
                </PWText>
            )}
        </PWView>
    )
}
