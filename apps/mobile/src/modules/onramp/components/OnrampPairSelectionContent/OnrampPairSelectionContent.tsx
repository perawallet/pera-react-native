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

import { useCallback, useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import { PWDivider, PWFlatList, PWText, PWView } from '@components/core'
import {
    useRampPairsQuery,
    type RampPair,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { OnrampAssetRow } from './OnrampAssetRow'
import { useStyles } from './styles'

export type OnrampPairSelectionContentProps = {
    variant?: 'source' | 'destination'
}

// Deduplicate pairs by token id so we show one row per unique token. The sheet
// resolves the selected TOKEN id; the form handler maps it back to a pair while
// preserving the other side of the pair.
const dedupeByToken = (
    pairs: RampPair[],
    variant: 'source' | 'destination',
): RampPair[] => {
    const seen = new Set<string>()
    const result: RampPair[] = []
    for (const pair of pairs) {
        const token =
            variant === 'source' ? pair.sourceToken : pair.destinationToken
        if (!seen.has(token.id)) {
            seen.add(token.id)
            result.push(pair)
        }
    }
    return result
}

const RowSeparator = () => <PWDivider />

export const OnrampPairSelectionContent = ({
    variant = 'destination',
}: OnrampPairSelectionContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<string>()
    const { data: pairs, isLoading } = useRampPairsQuery()

    const dedupedPairs = useMemo(
        () => dedupeByToken(pairs ?? [], variant),
        [pairs, variant],
    )

    const handleTokenSelected = useCallback(
        (token: RampToken) => {
            resolve(token.id)
        },
        [resolve],
    )

    const renderItem = useCallback(
        ({ item }: { item: RampPair }) => {
            const token =
                variant === 'source' ? item.sourceToken : item.destinationToken
            return (
                <OnrampAssetRow
                    token={token}
                    onPress={() => handleTokenSelected(token)}
                />
            )
        },
        [variant, handleTokenSelected],
    )

    const title =
        variant === 'destination'
            ? t('onramp.pair_selection.title_to')
            : t('onramp.pair_selection.title_from')

    return (
        <>
            <SheetHeader title={title} />
            <PWView style={styles.body}>
                {isLoading ? (
                    <PWView style={styles.centered}>
                        <ActivityIndicator />
                    </PWView>
                ) : (
                    <PWFlatList<RampPair>
                        data={dedupedPairs}
                        keyExtractor={pair => pair.id}
                        renderItem={renderItem}
                        inBottomSheet
                        ItemSeparatorComponent={RowSeparator}
                        ListEmptyComponent={
                            <PWView style={styles.centered}>
                                <PWText
                                    variant='body'
                                    style={styles.emptyText}
                                >
                                    {t('onramp.pair_selection.empty')}
                                </PWText>
                            </PWView>
                        }
                    />
                )}
            </PWView>
        </>
    )
}
