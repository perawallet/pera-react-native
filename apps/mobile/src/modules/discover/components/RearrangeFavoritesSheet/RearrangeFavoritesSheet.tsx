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
import DraggableFlatList, {
    ScaleDecorator,
    type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { dappSubtitle } from '../../utils/dappSubtitle'
import { DappLogo } from '../DappLogo'
import {
    useRearrangeFavoritesSheet,
    type RearrangeFavoriteEntry,
} from './useRearrangeFavoritesSheet'
import { useStyles } from './styles'

const keyOf = (entry: RearrangeFavoriteEntry) => entry.key

/**
 * Reorders favorites and takes some out (Figma "Rearrange"). Nothing is saved
 * until Apply; Cancel discards.
 */
export const RearrangeFavoritesSheet = () => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const sheet = useRearrangeFavoritesSheet()
    const { remove, reorder, beginDrag } = sheet

    const renderItem = useCallback(
        ({ item, drag }: RenderItemParams<RearrangeFavoriteEntry>) => (
            <ScaleDecorator activeScale={0.97}>
                <PWView
                    style={styles.row}
                    testID={`discover_rearrange_row_${item.key}`}
                >
                    <DappLogo logo={item.dapp.logo} />
                    <PWView style={styles.info}>
                        <PWText
                            variant='bodyLarge'
                            weight={500}
                            numberOfLines={1}
                        >
                            {item.dapp.name}
                        </PWText>
                        <PWText
                            variant='footnoteMedium'
                            weight={400}
                            numberOfLines={1}
                            style={styles.subtitle}
                        >
                            {dappSubtitle(item.dapp)}
                        </PWText>
                    </PWView>
                    <PWTouchableOpacity
                        onPress={() => remove(item.key)}
                        style={[styles.square, styles.remove]}
                        accessibilityLabel={t(
                            'discover.favorites.rearrange.remove_label',
                            { name: item.dapp.name },
                        )}
                        testID={`discover_rearrange_remove_${item.key}`}
                    >
                        <PWIcon
                            name='cross'
                            variant='negative'
                        />
                    </PWTouchableOpacity>
                    {/* Never toggles `disabled`: that remounts the touchable holding the
                        touch, and the stale responder eats the next tap (Android). */}
                    <PWTouchableOpacity
                        onPressIn={drag}
                        style={[styles.square, styles.handle]}
                    >
                        <PWIcon
                            name='horizontal-line-stack'
                            variant='secondary'
                        />
                    </PWTouchableOpacity>
                </PWView>
            </ScaleDecorator>
        ),
        [styles, remove, t],
    )

    const handleDragEnd = useCallback(
        ({ data }: { data: RearrangeFavoriteEntry[] }) =>
            reorder(data.map(keyOf)),
        [reorder],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWButton
                        variant='linkPositive'
                        title={t('common.cancel.label')}
                        onPress={sheet.cancel}
                        paddingStyle='none'
                        testID='discover_rearrange_cancel'
                    />
                }
                center={
                    <PWText variant='h4'>
                        {t('discover.favorites.rearrange.title')}
                    </PWText>
                }
                right={
                    <PWButton
                        variant='linkPositive'
                        title={t('common.apply')}
                        onPress={sheet.apply}
                        paddingStyle='none'
                        testID='discover_rearrange_apply'
                    />
                }
                testID='discover_rearrange_header'
            />
            <DraggableFlatList
                data={sheet.entries}
                renderItem={renderItem}
                keyExtractor={keyOf}
                onDragBegin={beginDrag}
                onDragEnd={handleDragEnd}
                activationDistance={10}
                showsVerticalScrollIndicator={false}
                containerStyle={styles.listFill}
                contentContainerStyle={styles.listContent}
            />
        </PWView>
    )
}
