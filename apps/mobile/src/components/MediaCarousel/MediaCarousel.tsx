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
import { useWindowDimensions } from 'react-native'
import { PWView } from '@components/core'
import { useStyles } from './styles'
import { type MediaItem } from './resolveMediaImageUri'
import PagerView from 'react-native-pager-view'
import { useMediaCarousel } from './useMediaCarousel'

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
    const styles = useStyles(dimensions)

    const {
        pages,
        hasMultiple,
        activeIndex,
        handlePageSelected,
        renderMediaItem,
    } = useMediaCarousel({
        media,
        fallbackImageUrl,
        placeholderIconSize,
        onModelPress,
        onFullScreenPress,
    })

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
                onPageSelected={e => handlePageSelected(e.nativeEvent.position)}
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
