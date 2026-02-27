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

import { PWInput, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetSelector } from '../SwapAssetSelector'
import { useStyles } from './styles'

export type SwapPaySectionProps = {
    assetId: string | null
    balance: string
    amount: string
    onAmountChange: (amount: string) => void
    onAssetPress: () => void
}

export const SwapPaySection = ({
    assetId,
    balance,
    amount,
    onAmountChange,
    onAssetPress,
}: SwapPaySectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.headerRow}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.form.you_pay')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.balance}
                >
                    {t('swap.form.balance', { amount: balance })}
                </PWText>
            </PWView>

            <PWView style={styles.inputRow}>
                <PWView style={styles.amountContainer}>
                    <PWInput
                        value={amount}
                        onChangeText={onAmountChange}
                        keyboardType='decimal-pad'
                        placeholder='0.00'
                        containerStyle={styles.inputContainer}
                        inputContainerStyle={styles.inputInnerContainer}
                        inputStyle={styles.inputText}
                    />
                </PWView>

                <SwapAssetSelector
                    assetId={assetId}
                    onPress={onAssetPress}
                />
            </PWView>
        </PWView>
    )
}
