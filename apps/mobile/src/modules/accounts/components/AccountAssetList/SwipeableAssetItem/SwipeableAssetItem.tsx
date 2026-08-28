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

import React, { useCallback, useRef } from 'react'
import { type GestureResponderEvent } from 'react-native'
import {
    PWIcon,
    PWSwipeable,
    usePWPagerGesture,
    type PWSwipeableRef,
    PWView,
} from '@components/core'
import { type AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { AssetListItemView } from '../AssetListItemView'
import type { AssetFiatConverter } from '../useAssetListFiat'
import { useStyles } from './styles'

export type SwipeableAssetItemProps = {
    item: AccountHoldingsLiteRow
    isSwipeEnabled: boolean
    convertFiat: AssetFiatConverter
    onPress: (item: AccountHoldingsLiteRow) => void
    onOptOut: (item: AccountHoldingsLiteRow) => void
}

const SwipeableAssetItemInner = ({
    item,
    isSwipeEnabled,
    convertFiat,
    onPress,
    onOptOut,
}: SwipeableAssetItemProps) => {
    const styles = useStyles()
    const swipeableRef = useRef<PWSwipeableRef>(null)
    const pagerGesture = usePWPagerGesture()

    const handleSwipeOpen = useCallback(() => {
        swipeableRef.current?.close()
        onOptOut(item)
    }, [item, onOptOut])

    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            event.stopPropagation()
            onPress(item)
        },
        [item, onPress],
    )

    const renderRightActions = useCallback(() => {
        return (
            <PWView style={styles.swipeAction}>
                <PWIcon
                    name='trash'
                    variant='white'
                />
            </PWView>
        )
    }, [styles.swipeAction])

    if (!isSwipeEnabled) {
        return (
            <AssetListItemView
                holding={item}
                convertFiat={convertFiat}
                style={styles.itemContainer}
                onPress={handlePress}
            />
        )
    }

    return (
        <PWSwipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            onSwipeableOpen={handleSwipeOpen}
            overshootRight={false}
            // The account screen's pager owns the same axis as this swipe and is
            // an ancestor, so without this it wins the drag and the row stops
            // sliding. Blocking it makes the pager wait for this to fail.
            block={pagerGesture ?? undefined}
        >
            <PWView style={styles.swipeableContent}>
                <AssetListItemView
                    holding={item}
                    convertFiat={convertFiat}
                    style={styles.itemContainer}
                    onPress={handlePress}
                />
            </PWView>
        </PWSwipeable>
    )
}

export const SwipeableAssetItem = React.memo(SwipeableAssetItemInner)
