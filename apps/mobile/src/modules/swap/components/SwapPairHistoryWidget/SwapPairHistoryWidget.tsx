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
import {
    PWButton,
    PWFlatList,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import type { SwapDistinctPairItem } from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { SwapPairChip } from './SwapPairChip'
import { useSwapPairHistoryWidget } from './useSwapPairHistoryWidget'
import { useStyles } from './styles'

const SKELETON_COUNT = 3

export const SwapPairHistoryWidget = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        pairs,
        isLoading,
        isError,
        isEnabled,
        handlePairPress,
        handleSeeAllPress,
    } = useSwapPairHistoryWidget()

    const renderPair = useCallback(
        ({ item }: { item: SwapDistinctPairItem }) => (
            <SwapPairChip
                assetIn={item.assetIn}
                assetOut={item.assetOut}
                onPress={() => handlePairPress(item)}
            />
        ),
        [handlePairPress],
    )

    const keyExtractor = useCallback(
        (item: SwapDistinctPairItem) => item.pairKey,
        [],
    )

    const renderSeparator = useCallback(
        () => <PWView style={styles.separator} />,
        [styles.separator],
    )

    if (!isEnabled) return null

    if (isLoading) {
        return (
            <PWView style={styles.container}>
                <PWView style={styles.header}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t('swap.history.widget.title')}
                    </PWText>
                </PWView>
                <PWSkeleton
                    count={SKELETON_COUNT}
                    horizontal
                    style={styles.skeleton}
                />
            </PWView>
        )
    }

    if (isError) {
        return (
            <PWView style={styles.container}>
                <PWText
                    variant='body'
                    style={styles.errorText}
                >
                    {t('swap.history.widget.error')}
                </PWText>
            </PWView>
        )
    }

    if (pairs.length === 0) return null

    return (
        <PWView
            style={styles.container}
            testID='swap-pair-history-widget'
        >
            <PWView style={styles.header}>
                <PWText
                    variant='h4'
                    style={styles.title}
                    truncate
                >
                    {t('swap.history.widget.title')}
                </PWText>
                <PWButton
                    variant='linkPositive'
                    paddingStyle='none'
                    title={t('swap.history.widget.see_all')}
                    onPress={handleSeeAllPress}
                    testID='swap-pair-history-see-all'
                />
            </PWView>
            <PWFlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={pairs}
                renderItem={renderPair}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={renderSeparator}
                style={styles.list}
                contentContainerStyle={styles.listContent}
            />
        </PWView>
    )
}
