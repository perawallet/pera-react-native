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
import { PWInput, PWSkeleton, PWText, PWView } from '@components/core'
import { AmountField } from '@components/AmountField'
import { AssetSelector } from '@components/AssetSelector'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { isAlgoAssetId, type Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useSwapAmountSection } from './useSwapAmountSection'
import { useTheme } from '@rneui/themed'

type SwapAmountSectionPayProps = {
    variant: 'pay'
    assetId: string
    balance: Nullable<Decimal>
    amount: Nullable<Decimal>
    onAmountChange: (amount: Nullable<Decimal>) => void
    onAssetPress: () => void
    isLocalCurrencyInput?: boolean
    localCurrencySymbol?: string
    fiatToAsset?: (fiat: Nullable<Decimal>) => Nullable<Decimal>
    assetToFiat?: (asset: Nullable<Decimal>) => Nullable<Decimal>
}

type SwapAmountSectionReceiveProps = {
    variant: 'receive'
    assetId: string
    balance: Nullable<Decimal>
    amount: Nullable<Decimal>
    isLoading?: boolean
    onAssetPress: () => void
}

export type SwapAmountSectionProps =
    | SwapAmountSectionPayProps
    | SwapAmountSectionReceiveProps

export const SwapAmountSection = (props: SwapAmountSectionProps) => {
    const { variant, assetId, balance, amount, onAssetPress } = props
    const payProps = variant === 'pay' ? props : undefined
    const receiveProps = variant === 'receive' ? props : undefined

    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    const isAlgo = isAlgoAssetId(assetId)
    const isLoading = receiveProps?.isLoading ?? false
    const onAmountChange = payProps?.onAmountChange
    const isLocalCurrencyInput = payProps?.isLocalCurrencyInput ?? false
    const localCurrencySymbol = payProps?.localCurrencySymbol
    const fiatToAsset = payProps?.fiatToAsset
    const assetToFiat = payProps?.assetToFiat
    const {
        asset,
        isPay,
        isFiatInput,
        displayValue,
        hasPositiveAmount,
        handleTextChange,
        handleFocus,
        handleBlur,
    } = useSwapAmountSection({
        variant,
        assetId,
        amount,
        onAmountChange,
        isLocalCurrencyInput,
        fiatToAsset,
        assetToFiat,
    })

    return (
        <AmountField
            variant={isPay ? 'plain' : 'card'}
            label={isPay ? t('swap.form.you_pay') : t('swap.form.you_receive')}
            amountSize='h2'
            headerTrailing={
                <PWView style={styles.balanceWrapper}>
                    <PWText
                        variant='body'
                        style={styles.balance}
                    >
                        {t('swap.form.balance_label')}
                    </PWText>
                    <AssetAmount
                        value={balance ?? new Decimal(0)}
                        asset={asset}
                        symbolPosition={isAlgo ? 'start' : 'end'}
                        variant='body'
                        style={styles.balance}
                    />
                </PWView>
            }
            amount={
                isPay ? (
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
                        inputContainerStyle={styles.amountInputInnerContainer}
                        inputStyle={styles.amountInput}
                        leftIcon={
                            isFiatInput && localCurrencySymbol ? (
                                <PWText
                                    variant='h2'
                                    style={styles.currencyPrefix}
                                >
                                    {localCurrencySymbol}
                                </PWText>
                            ) : undefined
                        }
                        numberOfLines={1}
                        adjustsFontSizeToFit
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
                        testID='swap-receive-amount'
                    >
                        {displayValue || '0.00'}
                    </PWText>
                )
            }
            selector={
                <AssetSelector
                    assetId={assetId}
                    variant={variant}
                    onPress={onAssetPress}
                    fallbackLabel={t('swap.form.select_asset')}
                    testID={
                        isPay
                            ? 'swap-pay-asset-selector'
                            : 'swap-receive-asset-selector'
                    }
                />
            }
            fiat={
                isFiatInput ? (
                    <AssetAmount
                        value={amount ?? new Decimal(0)}
                        asset={asset}
                        symbolPosition={isAlgo ? 'start' : 'end'}
                        style={styles.fiatValue}
                    />
                ) : (
                    <PreferredAmount
                        sourceAmount={amount ?? new Decimal(0)}
                        sourceAssetId={assetId}
                        showSymbol
                        isLoading={isLoading}
                        style={styles.fiatValue}
                    />
                )
            }
        />
    )
}
