/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { useCallback, useRef, type ReactElement, type RefObject } from 'react'
import type { GestureResponderEvent } from 'react-native'
import {
    PWIcon,
    type PWSwipeableRef,
    PWView,
} from '@components/core'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'

export type UseSwipeableAssetItemProps = {
    item: AccountHoldingsLiteRow
    onPress: (item: AccountHoldingsLiteRow) => void
    onOptOut: (item: AccountHoldingsLiteRow) => void
}

export type UseSwipeableAssetItemResult = {
    swipeableRef: RefObject<PWSwipeableRef | null>
    handleSwipeOpen: () => void
    handlePress: (event: GestureResponderEvent) => void
    renderRightActions: () => ReactElement
}

export const useSwipeableAssetItem = ({
    item,
    onPress,
    onOptOut,
}: UseSwipeableAssetItemProps): UseSwipeableAssetItemResult => {
    const styles = useStyles()
    const swipeableRef = useRef<PWSwipeableRef>(null)

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

    return {
        swipeableRef,
        handleSwipeOpen,
        handlePress,
        renderRightActions,
    }
}
