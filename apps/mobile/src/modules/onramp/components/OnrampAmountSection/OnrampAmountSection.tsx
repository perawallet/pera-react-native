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

import { type Decimal } from 'decimal.js'
import { PWInput, PWSkeleton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    DEFAULT_PRECISION,
    ZERO_DECIMAL,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { type RampToken } from '@perawallet/wallet-core-onramp'
import { SwapAssetSelector } from '@modules/swap/components'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { buildDisplayableAssetFromRampToken } from '../buildDisplayableAssetFromRampToken'
import { useStyles } from './styles'
import { useOnrampAmountSection } from './useOnrampAmountSection'
import { useTheme } from '@rneui/themed'

type OnrampAmountSectionPayProps = {
    variant: 'pay'
    token: Nullable<RampToken>
    /** Raw source amount string owned by the form (`sourceAmount`). */
    amount: string
    onAmountChange: (value: string) => void
    onAssetPress: () => void
}

type OnrampAmountSectionReceiveProps = {
    variant: 'receive'
    token: Nullable<RampToken>
    /** Quoted destination amount (`destinationAmount`). */
    amount: Nullable<Decimal>
    onAssetPress: () => void
    isLoading?: boolean
}

export type OnrampAmountSectionProps =
    | OnrampAmountSectionPayProps
    | OnrampAmountSectionReceiveProps

export const OnrampAmountSection = (props: OnrampAmountSectionProps) => {
    const { variant, token, onAssetPress } = props
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles({ variant })

    const {
        isPay,
        inputValue,
        receiveValue,
        hasReceiveValue,
        isReceiveLoading,
        logoUrl,
        fiatBaseAmount,
        shouldUseUsdFallback,
        handleTextChange,
    } = useOnrampAmountSection({
        variant,
        token,
        amount: props.amount,
        isLoading: variant === 'receive' ? props.isLoading : false,
        onAmountChange: variant === 'pay' ? props.onAmountChange : undefined,
    })

    return (
        <PWView style={styles.container}>
            <PWText
                variant='body'
                style={styles.label}
            >
                {isPay
                    ? t('onramp.form.you_pay')
                    : t('onramp.form.you_receive')}
            </PWText>

            <PWView style={styles.inputRow}>
                <PWView style={styles.amountContainer}>
                    {isPay ? (
                        <PWInput
                            variant='h1'
                            value={inputValue}
                            onChangeText={handleTextChange}
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
                            testID='onramp-pay-input'
                        />
                    ) : isReceiveLoading ? (
                        <PWSkeleton
                            width={120}
                            height={40}
                        />
                    ) : (
                        <PWText
                            style={
                                hasReceiveValue
                                    ? styles.amountText
                                    : styles.amountTextMuted
                            }
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            testID='onramp-receive-amount'
                        >
                            {receiveValue || '0.00'}
                        </PWText>
                    )}
                </PWView>

                <SwapAssetSelector
                    variant={variant}
                    asset={
                        token
                            ? buildDisplayableAssetFromRampToken(token)
                            : undefined
                    }
                    label={token?.symbol ?? t('onramp.form.choose_asset')}
                    logoUrl={logoUrl}
                    onPress={onAssetPress}
                    testID='onramp-pair-selector'
                />
            </PWView>

            <PWView style={styles.fiatValueContainer}>
                <PreferredCurrencyDisplay
                    sourceAmount={fiatBaseAmount}
                    sourceAssetId={token?.id ?? ''}
                    usdPrice={token?.priceInUsd ?? ZERO_DECIMAL}
                    forceFallback={shouldUseUsdFallback}
                    precision={DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    variant='body'
                    style={styles.fiatValue}
                    testID={`onramp-${variant}-fiat-value`}
                />
            </PWView>
        </PWView>
    )
}
