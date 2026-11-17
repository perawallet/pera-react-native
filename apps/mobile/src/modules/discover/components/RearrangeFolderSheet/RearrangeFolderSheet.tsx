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
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { DappLogo } from '../DappLogo'
import {
    useRearrangeFolderSheet,
    type RearrangeEntry,
} from './useRearrangeFolderSheet'
import { useStyles } from './styles'

export type RearrangeFolderSheetProps = { folderId: string }

const keyOf = (entry: RearrangeEntry) => entry.key

/**
 * Reorders a folder's dApps and takes some out; open it with
 * `useBottomSheet().request<RearrangeFolderSheetResult>`. Done resolves the
 * keys, the close icon is Cancel.
 */
export const RearrangeFolderSheet = ({
    folderId,
}: RearrangeFolderSheetProps) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const sheet = useRearrangeFolderSheet({ folderId })
    const { remove, reorder, beginDrop } = sheet

    const renderItem = useCallback(
        ({ item, drag }: RenderItemParams<RearrangeEntry>) => (
            <ScaleDecorator activeScale={0.97}>
                <PWView
                    style={styles.row}
                    testID={`discover_rearrange_row_${item.key}`}
                >
                    <PWTouchableOpacity
                        onPress={() => remove(item.key)}
                        style={styles.remove}
                        accessibilityLabel={t(
                            'discover.folders.rearrange.remove_label',
                            { name: item.dapp.name },
                        )}
                        testID={`discover_rearrange_remove_${item.key}`}
                    >
                        <PWIcon
                            name='cross'
                            variant='secondary'
                        />
                    </PWTouchableOpacity>
                    <DappLogo logo={item.dapp.logo} />
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        numberOfLines={1}
                        style={styles.name}
                    >
                        {item.dapp.name}
                    </PWText>
                    {/* Never toggles `disabled`: that remounts the touchable holding the
                        touch, and the stale responder eats the next tap (Android). */}
                    <PWTouchableOpacity
                        onPressIn={drag}
                        style={styles.dragHandle}
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
        ({ data }: { data: RearrangeEntry[] }) => reorder(data.map(keyOf)),
        [reorder],
    )

    return (
        <PWView style={styles.container}>
            <SheetHeader
                title={t('discover.folders.rearrange.title')}
                onClose={sheet.cancel}
                showClose
                testID='discover_rearrange_header'
                rightAction={
                    <PWButton
                        variant='linkPositive'
                        title={t('common.done')}
                        onPress={sheet.done}
                        paddingStyle='none'
                        testID='discover_rearrange_done'
                    />
                }
            />
            <DraggableFlatList
                data={sheet.entries}
                renderItem={renderItem}
                keyExtractor={keyOf}
                onRelease={beginDrop}
                onDragEnd={handleDragEnd}
                activationDistance={10}
                showsVerticalScrollIndicator={false}
                containerStyle={styles.listFill}
                contentContainerStyle={styles.listContent}
            />
        </PWView>
    )
}
