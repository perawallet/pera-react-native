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
import PagerView from 'react-native-pager-view'
import {
    PWBottomSheet,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZoomableImage } from '@components/ZoomableImage'
import { VideoPlayer } from '@components/VideoPlayer'
import { AudioPlayer } from '@components/AudioPlayer'
import { useStyles } from './styles'

export type FullScreenMediaItem = {
    uri: string
    type: 'image' | 'video' | 'audio'
    posterUri?: string
}

export type FullScreenImageViewerProps = {
    isVisible: boolean
    onClose: () => void
    media: FullScreenMediaItem[]
    initialIndex?: number
}

export const FullScreenImageViewer = ({
    isVisible,
    onClose,
    media,
    initialIndex = 0,
}: FullScreenImageViewerProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const [activeIndex, setActiveIndex] = useState(initialIndex)
    const hasMultiple = media.length > 1

    const handlePageSelected = useCallback(
        (e: { nativeEvent: { position: number } }) => {
            setActiveIndex(e.nativeEvent.position)
        },
        [],
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            onDismiss={onClose}
            size='full'
            containerStyle={styles.container}
            innerContainerStyle={styles.innerContainer}
        >
            <PWToolbar
                right={
                    <PWTouchableIcon
                        name='cross'
                        size='md'
                        variant='white'
                        onPress={onClose}
                    />
                }
            />

            {media.length > 0 ? (
                <PagerView
                    style={styles.pager}
                    initialPage={initialIndex}
                    onPageSelected={handlePageSelected}
                >
                    {media.map((item, index) => (
                        <PWView
                            key={index}
                            style={styles.page}
                        >
                            {item.type === 'video' ? (
                                <VideoPlayer uri={item.uri} />
                            ) : item.type === 'audio' ? (
                                <AudioPlayer
                                    uri={item.uri}
                                    posterUri={item.posterUri}
                                />
                            ) : (
                                <ZoomableImage uri={item.uri} />
                            )}
                        </PWView>
                    ))}
                </PagerView>
            ) : null}

            {hasMultiple && (
                <PWText
                    variant='caption'
                    style={styles.counterText}
                >
                    {activeIndex + 1} / {media.length}
                </PWText>
            )}
        </PWBottomSheet>
    )
}
