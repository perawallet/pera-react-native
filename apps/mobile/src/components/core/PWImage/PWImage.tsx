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

import {
    Image,
    type ImageProps,
    type ImageSource,
    type ImageContentFit,
} from 'expo-image'

import React, { useCallback, useEffect, useState } from 'react'
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
    testID?: string
    onLoad?: ImageProps['onLoad']
    onError?: ImageProps['onError']
    PlaceholderContent?: React.ReactElement
    /**
     * Show the built-in loading overlay (spinner or `PlaceholderContent`) while
     * the image loads. Defaults to `true`. Pass `false` when the caller owns the
     * pending UI and any overlay would flash over the content — e.g. the card
     * secure-view, where the reveal button is the sole loading indicator.
     */
    showLoadingIndicator?: boolean
    transition?: boolean | number
    width?: number
    height?: number
    /**
     * expo-image cache policy. Defaults to `'memory-disk'`. Pass `'none'` for
     * sensitive, single-use images (e.g. the card secure-view PAN/CVV) so they
     * are never written to the on-disk cache.
     */
    cachePolicy?: ImageProps['cachePolicy']
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
    showLoadingIndicator = true,
    transition = true,
    width,
    height,
    cachePolicy = 'memory-disk',
    testID,
}: PWImageProps) => {
    const styles = useStyles()
    const [isLoading, setIsLoading] = useState(true)

    const sourceUri =
        typeof source === 'object' && source !== null && 'uri' in source
            ? (source as ImageSource).uri
            : undefined

    // List cells recycle PWImage instances into new items: without this reset
    // a recycled cell keeps its stale "loaded" state and shows no indicator
    // while the next image downloads.
    useEffect(() => {
        setIsLoading(true)
    }, [sourceUri])

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
        <View
            style={imageStyle}
            testID={testID}
        >
            <Image
                source={source as ImageSource}
                style={styles.image}
                contentFit={contentFit}
                onLoad={handleLoad}
                onError={handleError}
                transition={transitionDuration}
                cachePolicy={cachePolicy}
                recyclingKey={sourceUri}
            />
            {showLoadingIndicator && isLoading && (
                <View style={styles.loadingOverlay}>
                    {PlaceholderContent ?? <ActivityIndicator />}
                </View>
            )}
        </View>
    )
}
