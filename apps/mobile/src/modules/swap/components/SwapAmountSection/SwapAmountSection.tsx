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

import { useCallback, useMemo } from 'react'
import Decimal from 'decimal.js'
import { PWInput, PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { SwapAssetSelector } from '../SwapAssetSelector'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed/dist/config/ThemeProvider'

type SwapAmountSectionPayProps = {
    variant: 'pay'
    assetId: string | null
    balance: Decimal | null
    amount: Decimal | null
    onAmountChange: (amount: Decimal | null) => void
    onAssetPress: () => void
}

type SwapAmountSectionReceiveProps = {
    variant: 'receive'
    assetId: string | null
    balance: Decimal | null
    amount: Decimal | null
    onAssetPress: () => void
}

export type SwapAmountSectionProps =
    | SwapAmountSectionPayProps
    | SwapAmountSectionReceiveProps

export const SwapAmountSection = (props: SwapAmountSectionProps) => {
    const { variant, assetId, balance, amount, onAssetPress } = props
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    const { data: assets } = useAssetsQuery(assetId ? [assetId] : [])
    const asset = useMemo(
        () => (assetId ? assets?.get(assetId) : undefined),
        [assets, assetId],
    )

    const isPay = variant === 'pay'

    const displayValue = useMemo(
        () => (amount ? amount.toString() : ''),
        [amount],
    )

    const hasPositiveAmount = amount !== null && amount.greaterThan(0)
    const amountColor = hasPositiveAmount
        ? theme.colors.textMain
        : theme.colors.textGrayLighter

    const handleTextChange = useCallback(
        (text: string) => {
            if (!isPay) return

            if (text === '') {
                props.onAmountChange(null)
                return
            }

            try {
                props.onAmountChange(new Decimal(text))
            } catch {
                // Ignore invalid decimal input
            }
        },
        [isPay, props],
    )

    return (
        <PWView style={isPay ? styles.container : styles.receiveContainer}>
            <PWView style={styles.headerRow}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {isPay
                        ? t('swap.form.you_pay')
                        : t('swap.form.you_receive')}
                </PWText>
                <CurrencyDisplay
                    value={balance}
                    currency={asset?.unitName ?? ''}
                    precision={asset?.decimals ?? 0}
                    prefix={t('swap.form.balance_label')}
                    showSymbol={false}
                    variant='body'
                    style={styles.balance}
                />
            </PWView>

            <PWView style={styles.inputRow}>
                <PWView style={styles.amountContainer}>
                    {isPay ? (
                        <PWInput
                            value={displayValue}
                            onChangeText={handleTextChange}
                            keyboardType='decimal-pad'
                            placeholder='0.00'
                            containerStyle={styles.inputContainer}
                            inputContainerStyle={styles.inputInnerContainer}
                            inputStyle={styles.inputText}
                            placeholderTextColor={theme.colors.textGrayLighter}
                        />
                    ) : (
                        <PWText
                            style={[styles.amountText, { color: amountColor }]}
                            variant='h2'
                        >
                            {displayValue || '0.00'}
                        </PWText>
                    )}
                </PWView>

                <SwapAssetSelector
                    assetId={assetId}
                    onPress={onAssetPress}
                />
            </PWView>
        </PWView>
    )
}
