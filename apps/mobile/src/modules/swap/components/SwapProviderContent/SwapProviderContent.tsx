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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'
import {
    PWIcon,
    PWImage,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { ProviderSelectionItem } from './ProviderSelectionItem'
import { useSwapProviderContent } from './useSwapProviderContent'
import { useStyles } from './styles'

// 'auto' is encoded as null on the wire so callers can pattern-match the result
// (undefined → dismissed; string → manual provider; null → auto).
export type SwapProviderResult = Nullable<string>

export type SwapProviderContentProps = {
    quotes: SwapQuote[]
    selectedProviderName: Nullable<string>
}

export const SwapProviderContent = ({
    quotes,
    selectedProviderName,
}: SwapProviderContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()
    const { resolve } = useBottomSheetResult<SwapProviderResult>()

    const { userSelection, rows, handleSelect } = useSwapProviderContent({
        quotes,
        selectedProviderName,
    })

    const handleApply = useCallback(() => {
        resolve(userSelection)
    }, [resolve, userSelection])

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('swap.provider.change_title')}
                    rightAction={
                        <PWTouchableOpacity
                            onPress={handleApply}
                            testID='swap-provider-apply'
                        >
                            <PWText variant='linkPositive'>
                                {t('swap.provider.apply')}
                            </PWText>
                        </PWTouchableOpacity>
                    }
                />
            }
        >
            <PWView style={styles.list}>
                <ProviderSelectionItem
                    left={
                        <PWIcon
                            name='sparkle-badge'
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
        </PWSheetLayout>
    )
}
