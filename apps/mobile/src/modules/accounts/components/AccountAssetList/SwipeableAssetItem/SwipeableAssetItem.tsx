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

import React, { useCallback, useRef } from 'react'
import { type GestureResponderEvent } from 'react-native'
import { PWIcon, PWSwipeable, type PWSwipeableRef, PWView } from '@components/core'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { type Decimal } from 'decimal.js'
import { useStyles } from './styles'

export type SwipeableAssetItemProps = {
    item: AssetWithAccountBalance
    isSwipeEnabled: boolean
    usdPrice?: Decimal
    onPress: (item: AssetWithAccountBalance) => void
    onOptOut: (item: AssetWithAccountBalance) => void
}

const SwipeableAssetItemInner = ({
    item,
    isSwipeEnabled,
    usdPrice,
    onPress,
    onOptOut,
}: SwipeableAssetItemProps) => {
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

    if (!isSwipeEnabled) {
        return (
            <AccountAssetItemView
                accountBalance={item}
                usdPrice={usdPrice}
                style={styles.itemContainer}
                onPress={handlePress}
                skipFetch
            />
        )
    }

    return (
        <PWSwipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            onSwipeableOpen={handleSwipeOpen}
            overshootRight={false}
        >
            <PWView style={styles.swipeableContent}>
                <AccountAssetItemView
                    accountBalance={item}
                    usdPrice={usdPrice}
                    style={styles.itemContainer}
                    onPress={handlePress}
                    skipFetch
                />
            </PWView>
        </PWSwipeable>
    )
}

export const SwipeableAssetItem = React.memo(SwipeableAssetItemInner)
