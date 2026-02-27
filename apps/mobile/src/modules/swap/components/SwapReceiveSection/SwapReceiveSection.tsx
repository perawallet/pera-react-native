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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetSelector } from '../SwapAssetSelector'
import { useStyles } from './styles'

export type SwapReceiveSectionProps = {
    assetId: string | null
    balance: string
    amount: string
    onAssetPress: () => void
    onMaxPress: () => void
    onSwapDirectionPress: () => void
}

export const SwapReceiveSection = ({
    assetId,
    balance,
    amount,
    onAssetPress,
    onMaxPress,
    onSwapDirectionPress,
}: SwapReceiveSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.outerContainer}>
            <PWView style={styles.midRow}>
                <PWTouchableOpacity
                    style={styles.swapDirectionButton}
                    onPress={onSwapDirectionPress}
                >
                    <PWIcon name='swap' />
                </PWTouchableOpacity>

                <PWView style={styles.maxRow}>
                    <PWTouchableOpacity onPress={onMaxPress}>
                        <PWIcon name='sliders' />
                    </PWTouchableOpacity>
                    <PWTouchableOpacity
                        style={styles.maxButton}
                        onPress={onMaxPress}
                    >
                        <PWText
                            variant='body'
                            style={styles.maxText}
                        >
                            {t('swap.form.max')}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>
            </PWView>

            <PWView style={styles.container}>
                <PWView style={styles.headerRow}>
                    <PWText
                        variant='body'
                        style={styles.label}
                    >
                        {t('swap.form.you_receive')}
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
                        <PWText style={styles.amountText}>{amount}</PWText>
                    </PWView>

                    <SwapAssetSelector
                        assetId={assetId}
                        onPress={onAssetPress}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
