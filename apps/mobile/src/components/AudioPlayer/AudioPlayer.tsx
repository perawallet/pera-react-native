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

import React, { useCallback } from 'react'
import {
    type StyleProp,
    useWindowDimensions,
    type ViewStyle,
} from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type AudioPlayerProps = {
    uri: string
    posterUri?: string
    width?: number
    height?: number
    style?: StyleProp<ViewStyle>
}

const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const total = Math.floor(seconds)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export const AudioPlayer = ({
    uri,
    posterUri,
    width: widthProp,
    height: heightProp,
    style,
}: AudioPlayerProps) => {
    const window = useWindowDimensions()
    const width = widthProp ?? window.width
    const height = heightProp ?? window.height
    const styles = useStyles({ width, height })
    const player = useAudioPlayer(uri)
    const status = useAudioPlayerStatus(player)

    const handleTogglePlayback = useCallback(() => {
        if (status.playing) {
            player.pause()
        } else {
            player.play()
        }
    }, [player, status.playing])

    const duration = status.duration > 0 ? status.duration : 0
    const currentTime = status.currentTime > 0 ? status.currentTime : 0
    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0

    return (
        <PWView style={[styles.container, style]}>
            {posterUri ? (
                <PWImage
                    source={{ uri: posterUri }}
                    style={styles.poster}
                    resizeMode='contain'
                />
            ) : (
                <PWView style={styles.posterPlaceholder}>
                    <PWIcon
                        name='card-stack'
                        size='xxl'
                        variant='white'
                    />
                </PWView>
            )}

            <PWView style={styles.controls}>
                <PWTouchableIcon
                    name={status.playing ? 'pause' : 'play'}
                    size='md'
                    variant='white'
                    onPress={handleTogglePlayback}
                />
                <PWText
                    variant='caption'
                    style={styles.timeLabel}
                >
                    {formatTime(currentTime)}
                </PWText>
                <PWView style={styles.progressTrack}>
                    <PWView
                        style={[
                            styles.progressFill,
                            { width: `${progress * 100}%` },
                        ]}
                    />
                </PWView>
                <PWText
                    variant='caption'
                    style={styles.timeLabel}
                >
                    {formatTime(duration)}
                </PWText>
            </PWView>
        </PWView>
    )
}
