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

import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { formatRelativeTime } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useCallback, useMemo } from 'react'
import { PeraNotification } from '@perawallet/wallet-core-platform-integration'

export type NotificationItemProps = {
    item: PeraNotification
}

export const NotificationItem = ({ item }: NotificationItemProps) => {
    const styles = useStyles()

    const getImage = useCallback(
        (notification: PeraNotification) => {
            const metadata = notification.metadata
            const imageUrl =
                metadata?.image_url ??
                metadata?.asset?.logo ??
                metadata?.icon?.logo

            if (imageUrl) {
                return (
                    <PWView style={styles.iconContainerNoBorder}>
                        {metadata?.icon?.shape === 'circle' ? (
                            <PWImage
                                source={{ uri: imageUrl }}
                                style={styles.imageCircle}
                                PlaceholderContent={
                                    <PWIcon
                                        name='bell'
                                        variant='secondary'
                                    />
                                }
                                transition
                            />
                        ) : (
                            <PWImage
                                source={{ uri: imageUrl }}
                                style={styles.image}
                                PlaceholderContent={
                                    <PWIcon
                                        name='bell'
                                        variant='secondary'
                                    />
                                }
                                transition
                            />
                        )}
                    </PWView>
                )
            } else {
                return (
                    <PWView style={styles.iconContainer}>
                        <PWIcon
                            name='bell'
                            variant='secondary'
                        />
                    </PWView>
                )
            }
        },
        [styles],
    )

    const handlePress = () => {
        //TODO: we need to invoke relevant deeplinks here as we implement them
    }

    const image = useMemo(() => getImage(item), [item, getImage])

    return (
        <PWTouchableOpacity
            onPress={handlePress}
            style={styles.container}
        >
            {image}
            <PWView style={styles.messageBox}>
                <PWText>{item.message}</PWText>
                <PWText style={styles.timeText}>
                    {formatRelativeTime(item.createdAt)}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
