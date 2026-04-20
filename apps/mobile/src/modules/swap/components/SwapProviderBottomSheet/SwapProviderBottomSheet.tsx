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

import { useTheme } from '@rneui/themed'
import {
    PWBottomSheet,
    PWIcon,
    PWImage,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { ProviderSelectionItem } from './ProviderSelectionItem'
import { useSwapProviderBottomSheet } from './useSwapProviderBottomSheet'
import { useStyles } from './styles'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type SwapProviderBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    quotes: SwapQuote[]
    selectedProviderName: Nullable<string>
    onApply: (providerName: Nullable<string>) => void
}

export const SwapProviderBottomSheet = ({
    isVisible,
    onClose,
    quotes,
    selectedProviderName,
    onApply,
}: SwapProviderBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()

    const { userSelection, rows, handleSelect, handleApply } =
        useSwapProviderBottomSheet({
            isVisible,
            quotes,
            selectedProviderName,
            onApply,
            onClose,
        })

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
                center={
                    <PWText variant='h4'>
                        {t('swap.provider.change_title')}
                    </PWText>
                }
                right={
                    <PWTouchableOpacity
                        onPress={handleApply}
                        testID='swap-provider-apply'
                    >
                        <PWText style={styles.applyText}>
                            {t('swap.provider.apply')}
                        </PWText>
                    </PWTouchableOpacity>
                }
            />
            <PWView style={styles.list}>
                <ProviderSelectionItem
                    left={
                        <PWIcon
                            name='sparkle'
                            size='lg'
                        />
                    }
                    label={t('swap.provider.auto_label')}
                    right={
                        <PWText
                            variant='body'
                            style={styles.autoDescription}
                        >
                            {t('swap.provider.auto_description')}
                        </PWText>
                    }
                    isSelected={userSelection === null}
                    onPress={() => handleSelect(null)}
                    testID='swap-provider-option-auto'
                />
                {rows.map((row, index) => (
                    <ProviderSelectionItem
                        key={`${row.quote.provider ?? 'unknown'}-${index}`}
                        left={
                            row.iconUrl ? (
                                <PWImage
                                    source={{ uri: row.iconUrl }}
                                    width={theme.spacing.xxl}
                                    height={theme.spacing.xxl}
                                    containerStyle={styles.logo}
                                />
                            ) : (
                                <PWView style={styles.logo} />
                            )
                        }
                        label={row.displayName}
                        right={
                            <PWView style={styles.rightTextColumn}>
                                <PWText
                                    variant='body'
                                    style={styles.amountText}
                                >
                                    {row.amountDisplay}
                                </PWText>
                                {row.fiatDisplay && (
                                    <PWText
                                        variant='body'
                                        style={styles.fiatText}
                                    >
                                        {row.fiatDisplay}
                                    </PWText>
                                )}
                            </PWView>
                        }
                        isSelected={userSelection === row.quote.provider}
                        onPress={() => handleSelect(row.quote.provider ?? null)}
                        testID={`swap-provider-option-${row.quote.provider ?? 'unknown'}`}
                    />
                ))}
            </PWView>
        </PWBottomSheet>
    )
}
