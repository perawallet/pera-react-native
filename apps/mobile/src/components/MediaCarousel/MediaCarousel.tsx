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

import React, { useCallback, useState } from 'react'
import { FlatList } from 'react-native'
import { PWIcon, PWIconSize, PWImage, PWView } from '@components/core'
import { useStyles } from './styles'

export type MediaItem = {
    type: string
    previewUrl?: string
    downloadUrl?: string
}

export type MediaCarouselProps = {
    media: MediaItem[]
    fallbackImageUrl?: string
    placeholderIconSize?: PWIconSize
}

export const MediaCarousel = ({
    media,
    fallbackImageUrl,
    placeholderIconSize = 'xl',
}: MediaCarouselProps) => {
    const styles = useStyles()
    const [activeIndex, setActiveIndex] = useState(0)

    const imageMedia = media.filter(m => m.type === 'image')
    const hasMultiple = imageMedia.length > 1

    const renderMediaItem = useCallback(
        ({ item }: { item: MediaItem }) => (
            <PWView style={styles.carouselItem}>
                {item.previewUrl || item.downloadUrl ? (
                    <PWImage
                        source={{ uri: item.previewUrl ?? item.downloadUrl }}
                        style={styles.image}
                        resizeMode='contain'
                    />
                ) : (
                    <PWView style={styles.placeholder}>
                        <PWIcon
                            name='card-stack'
                            size={placeholderIconSize ?? 'md'}
                        />
                    </PWView>
                )}
            </PWView>
        ),
        [styles, placeholderIconSize],
    )

    if (!imageMedia.length) {
        return (
            <PWView style={styles.container}>
                {fallbackImageUrl ? (
                    <PWImage
                        source={{ uri: fallbackImageUrl }}
                        style={styles.image}
                        resizeMode='contain'
                    />
                ) : (
                    <PWView style={styles.placeholder}>
                        <PWIcon
                            name='card-stack'
                            size={placeholderIconSize}
                        />
                    </PWView>
                )}
            </PWView>
        )
    }

    if (!hasMultiple) {
        const singleMedia = imageMedia[0]
        return (
            <PWView style={styles.container}>
                <PWImage
                    source={{
                        uri:
                            singleMedia.previewUrl ??
                            singleMedia.downloadUrl ??
                            fallbackImageUrl,
                    }}
                    style={styles.image}
                    resizeMode='contain'
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <FlatList
                data={imageMedia}
                renderItem={renderMediaItem}
                keyExtractor={(_, index) => `media-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                    const index = Math.round(
                        e.nativeEvent.contentOffset.x /
                            e.nativeEvent.layoutMeasurement.width,
                    )
                    setActiveIndex(index)
                }}
            />
            <PWView style={styles.indicator}>
                {imageMedia.map((_, i) => (
                    <PWView
                        key={i}
                        style={[
                            styles.dot,
                            i === activeIndex && styles.dotActive,
                        ]}
                    />
                ))}
            </PWView>
        </PWView>
    )
}
