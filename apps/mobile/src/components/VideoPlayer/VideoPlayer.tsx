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
import type { StyleProp, ViewStyle } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { PWView } from '@components/core'
import { useStyles } from './styles'

export type VideoPlayerProps = {
    uri: string
    width?: number
    height?: number
    autoPlay?: boolean
    loop?: boolean
    muted?: boolean
    style?: StyleProp<ViewStyle>
}

export const VideoPlayer = ({
    uri,
    width: widthProp,
    height: heightProp,
    autoPlay = true,
    loop = true,
    muted = true,
    style,
}: VideoPlayerProps) => {
    const styles = useStyles({ width: widthProp, height: heightProp })
    const player = useVideoPlayer(uri, player => {
        player.loop = loop
        player.muted = muted
        if (autoPlay) {
            player.play()
        }
    })

    return (
        <PWView style={styles.container}>
            <VideoView
                player={player}
                style={[styles.video, style]}
                contentFit='contain'
                nativeControls
            />
        </PWView>
    )
}
