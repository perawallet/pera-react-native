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

import type { Decimal } from 'decimal.js'
import { PWInput, PWSkeleton, PWText } from '@components/core'
import { AmountField } from '@components/AmountField'
import { AssetSelector } from '@components/AssetSelector'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { ZERO_DECIMAL, type Nullable } from '@perawallet/wallet-core-shared'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { buildDisplayableAssetFromRampToken } from '../buildDisplayableAssetFromRampToken'
import { useStyles } from './styles'
import { useOnrampAmountSection } from './useOnrampAmountSection'
import { useTheme } from '@rneui/themed'

type OnrampAmountSectionPayProps = {
    variant: 'pay'
    token: Nullable<RampToken>
    /** Raw text of the pay field, owned by the form. */
    amountText: string
    onAmountTextChange: (text: string) => void
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
    const styles = useStyles()
    const { scope } = useOnrampAccount()

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
        amountText: variant === 'pay' ? props.amountText : '',
        amount: variant === 'receive' ? props.amount : null,
        isLoading: variant === 'receive' ? props.isLoading : false,
        onAmountTextChange:
            variant === 'pay' ? props.onAmountTextChange : undefined,
    })

    return (
        <AmountField
            variant={isPay ? 'plain' : 'card'}
            label={
                isPay ? t('onramp.form.you_pay') : t('onramp.form.you_receive')
            }
            amountSize='h2'
            amount={
                isPay ? (
                    <PWInput
                        variant='h2'
                        value={inputValue}
                        onChangeText={handleTextChange}
                        keyboardType='decimal-pad'
                        placeholder='0.00'
                        placeholderTextColor={theme.colors.textGrayLighter}
                        containerStyle={styles.amountInputContainer}
                        inputContainerStyle={styles.amountInputInnerContainer}
                        inputStyle={styles.amountInput}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        testID='onramp-pay-input'
                    />
                ) : isReceiveLoading ? (
                    <PWSkeleton
                        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: amount skeleton width
                        width={120}
                        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: amount skeleton height
                        height={28}
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
                )
            }
            selector={
                <AssetSelector
                    variant={variant}
                    asset={
                        token
                            ? buildDisplayableAssetFromRampToken(token, scope)
                            : undefined
                    }
                    label={token?.symbol ?? t('onramp.form.choose_asset')}
                    logoUrl={logoUrl}
                    onPress={onAssetPress}
                    testID='onramp-pair-selector'
                />
            }
            fiat={
                <PreferredAmount
                    sourceAmount={fiatBaseAmount}
                    sourceAssetId={token?.id ?? ''}
                    usdPrice={token?.priceInUsd ?? ZERO_DECIMAL}
                    forceFallback={shouldUseUsdFallback}
                    variant='body'
                    style={styles.fiatValue}
                    testID={`onramp-${variant}-fiat-value`}
                />
            }
        />
    )
}
