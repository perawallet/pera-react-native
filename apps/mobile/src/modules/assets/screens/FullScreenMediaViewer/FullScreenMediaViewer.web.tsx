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
    PWImage,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { VideoPlayer } from '@components/VideoPlayer'
import { AudioPlayer } from '@components/AudioPlayer'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useFullScreenMediaViewer } from './useFullScreenMediaViewer.web'
import { useStyles } from './styles.web'

export type FullScreenMediaItem = {
    uri: string
    type: 'image' | 'video' | 'audio'
    posterUri?: string
}

export type FullScreenMediaViewerProps = {
    media: FullScreenMediaItem[]
    initialIndex?: number
}

// No PagerView or pinch-zoom on web: one item at a time with arrow controls,
// and the toolbar hands the full-resolution original to a browser tab.
export const FullScreenMediaViewer = ({
    media,
    initialIndex = 0,
}: FullScreenMediaViewerProps) => {
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult()
    const {
        activeIndex,
        activeItem,
        hasPrevious,
        hasNext,
        handlePrevious,
        handleNext,
        handleOpenOriginal,
    } = useFullScreenMediaViewer(media, initialIndex)
    const hasMultiple = media.length > 1

    return (
        <PWView style={styles.innerContainer}>
            <PWToolbar
                left={
                    <PWTouchableIcon
                        name='cross'
                        size='md'
                        variant='primary'
                        onPress={dismiss}
                    />
                }
                right={
                    activeItem ? (
                        <PWTouchableIcon
                            name='arrow-up-right'
                            size='md'
                            variant='primary'
                            onPress={handleOpenOriginal}
                            testID='full-screen-media-open-original'
                        />
                    ) : null
                }
            />

            {activeItem ? (
                <PWView
                    key={activeIndex}
                    style={styles.page}
                >
                    {activeItem.type === 'video' ? (
                        <VideoPlayer uri={activeItem.uri} />
                    ) : activeItem.type === 'audio' ? (
                        <AudioPlayer
                            uri={activeItem.uri}
                            posterUri={activeItem.posterUri}
                        />
                    ) : (
                        <PWImage
                            source={{ uri: activeItem.uri }}
                            style={styles.image}
                            resizeMode='contain'
                        />
                    )}
                </PWView>
            ) : null}

            {hasMultiple && (
                <PWView style={styles.pagination}>
                    <PWTouchableIcon
                        name='chevron-left'
                        size='md'
                        variant='primary'
                        disabled={!hasPrevious}
                        onPress={handlePrevious}
                        testID='full-screen-media-previous'
                    />
                    <PWText
                        variant='caption'
                        style={styles.counterText}
                    >
                        {activeIndex + 1} / {media.length}
                    </PWText>
                    <PWTouchableIcon
                        name='chevron-right'
                        size='md'
                        variant='primary'
                        disabled={!hasNext}
                        onPress={handleNext}
                        testID='full-screen-media-next'
                    />
                </PWView>
            )}
        </PWView>
    )
}
