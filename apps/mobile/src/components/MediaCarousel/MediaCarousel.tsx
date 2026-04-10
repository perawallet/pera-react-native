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
import { useWindowDimensions } from 'react-native'
import {
    PWIcon,
    PWIconSize,
    PWImage,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { VideoPlayer } from '@components/VideoPlayer'
import { AudioPlayer } from '@components/AudioPlayer'
import { useStyles } from './styles'
import PagerView from 'react-native-pager-view'

export type MediaItem = {
    type: string
    previewUrl?: string
    downloadUrl?: string
}

export type MediaCarouselProps = {
    media: MediaItem[]
    fallbackImageUrl?: string
    placeholderIconSize?: PWIconSize
    onFullScreenPress?: (index: number) => void
}

export const MediaCarousel = ({
    media,
    fallbackImageUrl,
    placeholderIconSize = 'xl',
    onFullScreenPress,
}: MediaCarouselProps) => {
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const [activeIndex, setActiveIndex] = useState(0)

    const displayMedia = media.filter(
        m => m.type === 'image' || m.type === 'video' || m.type === 'audio',
    )
    const hasMultiple = displayMedia.length > 1

    const renderMediaItem = useCallback(
        ({ item, index }: { item?: MediaItem; index: number }) => {
            const downloadUri = item?.downloadUrl
            return (
                <PWView
                    style={styles.carouselItem}
                    key={`media-${index}`}
                >
                    {item?.type === 'video' && downloadUri ? (
                        <VideoPlayer
                            uri={downloadUri}
                            style={styles.videoPlayer}
                            autoPlay={index === activeIndex}
                        />
                    ) : item?.type === 'audio' && downloadUri ? (
                        <AudioPlayer
                            uri={downloadUri}
                            posterUri={item?.previewUrl ?? fallbackImageUrl}
                            style={styles.videoPlayer}
                        />
                    ) : item?.previewUrl ||
                      item?.downloadUrl ||
                      fallbackImageUrl ? (
                        <PWImage
                            source={{
                                uri:
                                    item?.previewUrl ??
                                    item?.downloadUrl ??
                                    fallbackImageUrl,
                            }}
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
                    {onFullScreenPress && index >= 0 && (
                        <PWTouchableIcon
                            style={styles.fullScreenButton}
                            onPress={() => onFullScreenPress(index)}
                            name='full-view'
                            size='lg'
                            variant='white'
                        />
                    )}
                </PWView>
            )
        },
        [
            styles,
            placeholderIconSize,
            onFullScreenPress,
            fallbackImageUrl,
            activeIndex,
        ],
    )

    if (!displayMedia.length) {
        return renderMediaItem({ index: -1 })
    }

    if (!hasMultiple) {
        const singleMedia = displayMedia[0]
        return renderMediaItem({ item: singleMedia, index: 0 })
    }

    return (
        <PWView style={styles.container}>
            <PagerView
                style={styles.pagerView}
                onPageSelected={e => setActiveIndex(e.nativeEvent.position)}
            >
                {displayMedia.map((item, index) => (
                    <PWView
                        key={index}
                        style={styles.carouselItem}
                    >
                        {renderMediaItem({ item, index })}
                    </PWView>
                ))}
            </PagerView>

            <PWView style={styles.indicator}>
                {displayMedia.map((_, i) => (
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
