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

import React from 'react'
import {
    PWSwipeable,
    PWSWIPEABLE_IGNORE_DIRECTION,
    usePWPagerGesture,
    PWView,
} from '@components/core'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { AssetListItemView } from '../AssetListItemView'
import type { AssetFiatConverter } from '@modules/assets'
import { useStyles } from './styles'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useSwipeableAssetItem,
    type AssetRowSwipeAction,
} from './useSwipeableAssetItem'

export type SwipeableAssetItemProps = {
    item: AccountHoldingsLiteRow
    chainId: ChainId
    /** Null leaves the row unswipeable. */
    swipeAction: Nullable<AssetRowSwipeAction>
    /** Listed under its group: names its network in the subtitle. */
    isGroupMember?: boolean
    shouldShowChainBadge?: boolean
    convertFiat: AssetFiatConverter
    onPress: (item: AccountHoldingsLiteRow) => void
    onSwipeAction: (
        item: AccountHoldingsLiteRow,
        action: AssetRowSwipeAction,
    ) => void
}

const SwipeableAssetItemInner = ({
    item,
    chainId,
    swipeAction,
    isGroupMember,
    shouldShowChainBadge = false,
    convertFiat,
    onPress,
    onSwipeAction,
}: SwipeableAssetItemProps) => {
    const styles = useStyles()
    const pagerGesture = usePWPagerGesture()

    const { swipeableRef, handleSwipeOpen, handlePress, renderRightActions } =
        useSwipeableAssetItem({ item, swipeAction, onPress, onSwipeAction })

    if (!swipeAction) {
        return (
            <AssetListItemView
                holding={item}
                chainId={chainId}
                isGroupMember={isGroupMember}
                shouldShowChainBadge={shouldShowChainBadge}
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
            // The account screen's pager owns the same axis as this swipe and
            // is an ancestor, so without this it wins the drag and the row stops
            // sliding. Blocking makes the pager wait for this to fail — and only
            // its leftward pan is exposed, so a rightward swipe still reaches
            // the drawer.
            block={pagerGesture ?? undefined}
            // Rightward reveals nothing here: opening runs the action and
            // closes immediately, so there is never a row to swipe shut. Left
            // unset it would still capture that drag at the default 10 and
            // silently swallow it, which is what stopped the drawer opening from
            // a row.
            dragOffsetFromLeft={PWSWIPEABLE_IGNORE_DIRECTION}
        >
            <PWView style={styles.swipeableContent}>
                <AssetListItemView
                    holding={item}
                    chainId={chainId}
                    isGroupMember={isGroupMember}
                    shouldShowChainBadge={shouldShowChainBadge}
                    convertFiat={convertFiat}
                    style={styles.itemContainer}
                    onPress={handlePress}
                />
            </PWView>
        </PWSwipeable>
    )
}

export const SwipeableAssetItem = React.memo(SwipeableAssetItemInner)
