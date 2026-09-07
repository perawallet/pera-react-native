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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapTopPairItem } from './SwapTopPairItem'
import { useSwapTopPairs } from './useSwapTopPairs'
import { useStyles } from './styles'

const SKELETON_ROWS = 5

export const SwapTopPairs = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { pairs, isLoading, isError, handlePairPress } = useSwapTopPairs()

    if (!isLoading && !isError && pairs.length === 0) {
        return null
    }

    return (
        <PWView
            style={styles.container}
            testID='swap-top-pairs'
        >
            <PWView style={styles.header}>
                <PWText
                    variant='h4'
                    style={styles.headerTitle}
                    truncate
                >
                    {t('swap.top_pairs.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.headerLabel}
                    truncate
                >
                    {t('swap.top_pairs.volume_24h')}
                </PWText>
            </PWView>

            {isLoading &&
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <PWView
                        key={`skeleton-${i}`}
                        style={styles.skeletonRow}
                        testID={`swap-top-pairs-skeleton-${i}`}
                    />
                ))}

            {isError && (
                <PWText
                    variant='body'
                    style={styles.errorText}
                >
                    {t('swap.top_pairs.error')}
                </PWText>
            )}

            {!isLoading &&
                !isError &&
                pairs.map((pair, i) => (
                    <SwapTopPairItem
                        key={`${pair.assetA.assetId}-${pair.assetB.assetId}`}
                        index={i + 1}
                        pair={pair}
                        onPress={handlePairPress}
                    />
                ))}
        </PWView>
    )
}
