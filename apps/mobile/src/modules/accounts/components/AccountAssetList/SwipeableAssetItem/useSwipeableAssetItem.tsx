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

import { useCallback, useRef, type ReactElement, type RefObject } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { PWIcon, type PWSwipeableRef, PWView } from '@components/core'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

/** What a swipe does to the row: opt the account out of the asset on chain, or hide the token locally. */
export type AssetRowSwipeAction = 'optOut' | 'hide'

export type UseSwipeableAssetItemProps = {
    item: AccountHoldingsLiteRow
    swipeAction: Nullable<AssetRowSwipeAction>
    onPress: (item: AccountHoldingsLiteRow) => void
    onSwipeAction: (
        item: AccountHoldingsLiteRow,
        action: AssetRowSwipeAction,
    ) => void
}

export type UseSwipeableAssetItemResult = {
    swipeableRef: RefObject<Nullable<PWSwipeableRef>>
    handleSwipeOpen: () => void
    handlePress: (event: GestureResponderEvent) => void
    renderRightActions: () => ReactElement
}

export const useSwipeableAssetItem = ({
    item,
    swipeAction,
    onPress,
    onSwipeAction,
}: UseSwipeableAssetItemProps): UseSwipeableAssetItemResult => {
    const styles = useStyles()
    const swipeableRef = useRef<PWSwipeableRef>(null)

    const handleSwipeOpen = useCallback(() => {
        swipeableRef.current?.close()
        if (swipeAction) onSwipeAction(item, swipeAction)
    }, [item, swipeAction, onSwipeAction])

    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            event.stopPropagation()
            onPress(item)
        },
        [item, onPress],
    )

    const renderRightActions = useCallback(() => {
        return (
            <PWView
                style={[
                    styles.swipeAction,
                    swipeAction === 'hide' && styles.hideSwipeAction,
                ]}
            >
                <PWIcon
                    name={swipeAction === 'hide' ? 'eye' : 'trash'}
                    variant='white'
                />
            </PWView>
        )
    }, [styles.swipeAction, styles.hideSwipeAction, swipeAction])

    return {
        swipeableRef,
        handleSwipeOpen,
        handlePress,
        renderRightActions,
    }
}
