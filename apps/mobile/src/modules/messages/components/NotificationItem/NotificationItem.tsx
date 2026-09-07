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

import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { formatRelativeTime } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useMemo } from 'react'
import type { PeraNotification } from '@perawallet/wallet-core-messages'
import { UnreadIndicator } from '../UnreadIndicator'

export type NotificationItemProps = {
    item: PeraNotification
    onPress: (notification: PeraNotification) => void
}

export const NotificationItem = ({ item, onPress }: NotificationItemProps) => {
    const styles = useStyles()

    const image = useMemo(() => {
        if (item.icon?.logo) {
            const isCircle = item.icon.shape === 'circle'
            return (
                <PWView style={styles.iconContainerNoBorder}>
                    <PWImage
                        source={{ uri: item.icon.logo }}
                        style={isCircle ? styles.imageCircle : styles.image}
                        PlaceholderContent={
                            <PWIcon
                                name='bell'
                                variant='secondary'
                            />
                        }
                        transition
                    />
                </PWView>
            )
        }

        return (
            <PWView style={styles.iconContainer}>
                <PWIcon
                    name='bell'
                    variant='secondary'
                />
            </PWView>
        )
    }, [item.icon, styles])

    return (
        <PWTouchableOpacity
            onPress={() => onPress(item)}
            style={styles.container}
            testID={`notification_row_${item.id}`}
        >
            <PWView style={styles.unreadIndicatorWrapper}>
                <UnreadIndicator isUnread={item.isUnread ?? false} />
            </PWView>
            {image}
            <PWView style={styles.messageBox}>
                {!!item.message && (
                    <PWText style={styles.messageText}>{item.message}</PWText>
                )}
                <PWText
                    variant='caption'
                    style={styles.timeText}
                >
                    {formatRelativeTime(item.createdAt)}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
