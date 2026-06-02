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
import { PWText, PWToolbar, PWTouchableIcon, PWView } from '@components/core'
import { ZoomableImage } from '@components/ZoomableImage'
import { VideoPlayer } from '@components/VideoPlayer'
import { AudioPlayer } from '@components/AudioPlayer'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

export type FullScreenMediaItem = {
    uri: string
    type: 'image' | 'video' | 'audio'
    posterUri?: string
}

export type FullScreenMediaViewerProps = {
    media: FullScreenMediaItem[]
    initialIndex?: number
}

export const FullScreenMediaViewer = ({
    media,
    initialIndex = 0,
}: FullScreenMediaViewerProps) => {
    const styles = useStyles()
    const [activeIndex, setActiveIndex] = useState(initialIndex)
    const hasMultiple = media.length > 1
    const { dismiss } = useBottomSheetResult()

    const handlePageSelected = useCallback(
        (e: { nativeEvent: { position: number } }) => {
            setActiveIndex(e.nativeEvent.position)
        },
        [],
    )

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
        </PWView>
    )
}
