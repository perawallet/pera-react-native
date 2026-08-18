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

import React, { useCallback, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useTheme } from '@rneui/themed'
import {
    PWIcon,
    type PWIconSize,
    PWImage,
    PWText,
    PWTouchableIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { VideoPlayer } from '@components/VideoPlayer'
import { AudioPlayer } from '@components/AudioPlayer'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { resolveMediaImageUri, type MediaItem } from './resolveMediaImageUri'
import PagerView from 'react-native-pager-view'

export type MediaCarouselProps = {
    media: MediaItem[]
    fallbackImageUrl?: string
    placeholderIconSize?: PWIconSize
    onModelPress?: () => void
    onFullScreenPress?: (index: number) => void
}

export const MediaCarousel = ({
    media,
    fallbackImageUrl,
    placeholderIconSize = 'xl',
    onModelPress,
    onFullScreenPress,
}: MediaCarouselProps) => {
    const dimensions = useWindowDimensions()
    const { theme } = useTheme()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const [activeIndex, setActiveIndex] = useState(0)
    // Keyed by uri rather than a boolean so a CDN failure on one page doesn't
    // blank out the other pages of the carousel.
    const [failedUris, setFailedUris] = useState<ReadonlySet<string>>(
        () => new Set(),
    )

    const handleImageError = useCallback((uri: string) => {
        setFailedUris(prev => new Set(prev).add(uri))
    }, [])

    // VideoPlayer defaults to the full window without explicit width/height.
    const mediaSize = dimensions.width - 2 * theme.spacing.xl

    // A model isn't its own page: its 3D badge rides on the visual media, and
    // its poster only becomes the page when there's no visual media at all.
    const visualMedia = media.filter(
        m => m.type === 'image' || m.type === 'video' || m.type === 'audio',
    )
    const modelItem = media.find(m => m.type === 'model')
    // No model file means nothing to open as 3D.
    const hasModel = modelItem?.downloadUrl !== undefined
    const pages =
        visualMedia.length > 0 ? visualMedia : modelItem ? [modelItem] : []
    const hasMultiple = pages.length > 1

    const renderMediaItem = useCallback(
        ({ item, index }: { item?: MediaItem; index: number }) => {
            const downloadUri = item?.downloadUrl
            const isModelItem = item?.type === 'model'
            const imageUri = resolveMediaImageUri(item, fallbackImageUrl)
            return (
                <PWView
                    style={styles.carouselItem}
                    key={`media-${index}`}
                >
                    {item?.type === 'video' && downloadUri ? (
                        <VideoPlayer
                            uri={downloadUri}
                            width={mediaSize}
                            height={mediaSize}
                            style={styles.videoPlayer}
                            autoPlay={index === activeIndex}
                        />
                    ) : item?.type === 'audio' && downloadUri ? (
                        <AudioPlayer
                            uri={downloadUri}
                            posterUri={item?.previewUrl ?? fallbackImageUrl}
                            width={mediaSize}
                            height={mediaSize}
                            style={styles.videoPlayer}
                        />
                    ) : imageUri && !failedUris.has(imageUri) ? (
                        <PWImage
                            source={{ uri: imageUri }}
                            style={styles.image}
                            resizeMode='contain'
                            onError={() => handleImageError(imageUri)}
                        />
                    ) : (
                        <PWView style={styles.placeholder}>
                            <PWIcon
                                name='image-off'
                                variant='secondary'
                                size={placeholderIconSize ?? 'md'}
                            />
                        </PWView>
                    )}
                    {hasModel && index >= 0 && (
                        <PWTouchableOpacity
                            style={styles.modelBadge}
                            onPress={onModelPress}
                            disabled={!onModelPress}
                            testID='model-3d-badge'
                        >
                            <PWIcon
                                name='cube-3d'
                                variant='white'
                                size='sm'
                            />
                            <PWText style={styles.modelBadgeText}>
                                {t('asset_details.collectible.model_3d_mode')}
                            </PWText>
                        </PWTouchableOpacity>
                    )}
                    {onFullScreenPress && index >= 0 && !isModelItem && (
                        <PWTouchableIcon
                            containerStyle={styles.fullScreenButton}
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
            hasModel,
            onModelPress,
            onFullScreenPress,
            fallbackImageUrl,
            activeIndex,
            mediaSize,
            t,
            failedUris,
            handleImageError,
        ],
    )

    if (!pages.length) {
        return renderMediaItem({ index: -1 })
    }

    if (!hasMultiple) {
        return renderMediaItem({ item: pages[0], index: 0 })
    }

    return (
        <PWView>
            <PagerView
                style={styles.pagerView}
                onPageSelected={e => setActiveIndex(e.nativeEvent.position)}
            >
                {pages.map((item, index) => (
                    <PWView
                        key={index}
                        style={styles.page}
                    >
                        {renderMediaItem({ item, index })}
                    </PWView>
                ))}
            </PagerView>

            <PWView style={styles.indicator}>
                {pages.map((_, i) => (
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
