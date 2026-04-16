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
import { PWInput, PWSkeleton, PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { isAlgoAsset } from '@perawallet/wallet-core-assets'
import { SwapAssetSelector } from '../SwapAssetSelector'
import { useStyles } from './styles'
import { useSwapAmountSection } from './useSwapAmountSection'
import { useTheme } from '@rneui/themed'

type SwapAmountSectionPayProps = {
    variant: 'pay'
    assetId: string
    balance: Decimal | null
    amount: Decimal | null
    onAmountChange: (amount: Decimal | null) => void
    onAssetPress: () => void
}

type SwapAmountSectionReceiveProps = {
    variant: 'receive'
    assetId: string
    balance: Decimal | null
    amount: Decimal | null
    isLoading?: boolean
    onAssetPress: () => void
}

export type SwapAmountSectionProps =
    | SwapAmountSectionPayProps
    | SwapAmountSectionReceiveProps

export const SwapAmountSection = (props: SwapAmountSectionProps) => {
    const { variant, assetId, balance, amount, onAssetPress } = props
    const isLoading = variant === 'receive' ? props.isLoading : false
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    const isAlgo = isAlgoAsset(assetId)
    const onAmountChange = variant === 'pay' ? props.onAmountChange : undefined
    const {
        asset,
        isPay,
        displayValue,
        hasPositiveAmount,
        handleTextChange,
        handleFocus,
        handleBlur,
    } = useSwapAmountSection({ variant, assetId, amount, onAmountChange })

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
                <PWView style={styles.balanceWrapper}>
                    <PWText
                        variant='body'
                        style={styles.balance}
                    >
                        {t('swap.form.balance_label')}
                    </PWText>
                    <CurrencyDisplay
                        value={balance ?? new Decimal(0)}
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? 0}
                        minPrecision={
                            balance === null || balance.equals(0) ? 0 : 2
                        }
                        symbolPosition={isAlgo ? 'start' : 'end'}
                        variant='body'
                        style={styles.balance}
                    />
                </PWView>
            </PWView>

            <PWView style={styles.inputRow}>
                <PWView style={styles.amountContainer}>
                    {isPay ? (
                        <PWInput
                            variant='h2'
                            value={displayValue}
                            onChangeText={handleTextChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            keyboardType='decimal-pad'
                            placeholder='0.00'
                            placeholderTextColor={theme.colors.textGrayLighter}
                            containerStyle={styles.amountInputContainer}
                            inputContainerStyle={
                                styles.amountInputInnerContainer
                            }
                            inputStyle={styles.amountInput}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                            testID='swap-pay-input'
                        />
                    ) : isLoading ? (
                        <PWSkeleton
                            width={120}
                            height={28}
                        />
                    ) : (
                        <PWText
                            style={
                                hasPositiveAmount
                                    ? styles.amountText
                                    : styles.amountTextMuted
                            }
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                            testID='swap-receive-amount'
                        >
                            {displayValue || '0.00'}
                        </PWText>
                    )}
                </PWView>

                <SwapAssetSelector
                    assetId={assetId}
                    variant={variant}
                    onPress={onAssetPress}
                />
            </PWView>
        </PWView>
    )
}
