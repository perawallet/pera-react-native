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

import { Image, type ImageProps, type ImageSource, type ImageContentFit } from 'expo-image'

import React, { useCallback, useState } from 'react'
import {
    ActivityIndicator,
    type ImageSourcePropType,
    type StyleProp,
    type ImageStyle,
    View,
    type ViewStyle,
} from 'react-native'

import { useStyles } from './styles'
import { SHORT_PROMPT_DISPLAY_DELAY } from '@constants/ui'

export type PWImageProps = {
    source: ImageSource | ImageSourcePropType
    style?: StyleProp<ImageStyle>
    containerStyle?: StyleProp<ViewStyle>
    placeholderStyle?: StyleProp<ImageStyle>
    resizeMode?: 'cover' | 'contain' | 'center' | 'stretch' | 'repeat'
    onLoad?: ImageProps['onLoad']
    onError?: ImageProps['onError']
    PlaceholderContent?: React.ReactElement
    transition?: boolean | number
    width?: number
    height?: number
}

const RESIZE_MODE_TO_CONTENT_FIT: Record<string, ImageContentFit> = {
    cover: 'cover',
    contain: 'contain',
    center: 'none',
    stretch: 'fill',
    repeat: 'cover',
}

export const PWImage = ({
    source,
    style,
    containerStyle,
    resizeMode,
    onLoad,
    onError,
    PlaceholderContent,
    transition = true,
    width,
    height,
}: PWImageProps) => {
    const styles = useStyles()
    const [isLoading, setIsLoading] = useState(true)

    const contentFit = resizeMode
        ? RESIZE_MODE_TO_CONTENT_FIT[resizeMode]
        : undefined
    const transitionDuration =
        transition === false
            ? 0
            : typeof transition === 'number'
              ? transition
              : SHORT_PROMPT_DISPLAY_DELAY

    const handleLoad = useCallback<NonNullable<ImageProps['onLoad']>>(
        event => {
            setIsLoading(false)
            onLoad?.(event)
        },
        [onLoad],
    )

    const handleError = useCallback<NonNullable<ImageProps['onError']>>(
        event => {
            setIsLoading(false)
            onError?.(event)
        },
        [onError],
    )

    const imageStyle = [
        style,
        containerStyle as StyleProp<ImageStyle>,
        width ? { width } : undefined,
        height ? { height } : undefined,
    ]

    return (
        <View style={imageStyle}>
            <Image
                source={source as ImageSource}
                style={styles.image}
                contentFit={contentFit}
                onLoad={handleLoad}
                onError={handleError}
                transition={transitionDuration}
                cachePolicy='memory-disk'
                recyclingKey={
                    typeof source === 'object' &&
                    source !== null &&
                    'uri' in source
                        ? (source as ImageSource).uri
                        : undefined
                }
            />
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    {PlaceholderContent ?? <ActivityIndicator />}
                </View>
            )}
        </View>
    )
}
