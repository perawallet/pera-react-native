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

import { Image as RNEImage, ImageProps as RNEImageProps } from '@rneui/themed'

import { ActivityIndicator } from 'react-native'

/**
 * Props for the PWImage component.
 */
export type PWImageProps = {
    /** Image source (URI or local asset) */
    source: RNEImageProps['source']
    /** Optional style overrides for the image */
    style?: RNEImageProps['style']
    /** Optional style overrides for the image container */
    containerStyle?: RNEImageProps['containerStyle']
    /** Optional style overrides for the placeholder view */
    placeholderStyle?: RNEImageProps['placeholderStyle']
    /** How the image should be resized */
    resizeMode?: RNEImageProps['resizeMode']
    /** Callback when the image successfully loads */
    onLoad?: RNEImageProps['onLoad']
    /** Callback when the image fails to load */
    onError?: RNEImageProps['onError']
    /** Content to display while the image is loading */
    PlaceholderContent?: RNEImageProps['PlaceholderContent']
    /** Whether to enable image transition animation */
    transition?: boolean
    /** Explicit width for the image */
    width?: number
    /** Explicit height for the image */
    height?: number
}

/**
 * A themed image component with support for placeholders and transitions.
 * Wraps RNE Image with standard configurations.
 *
 * @example
 * <PWImage source={{ uri: 'https://example.com/image.png' }} width={100} height={100} />
 */
export const PWImage = ({
    source,
    style,
    containerStyle,
    placeholderStyle,
    resizeMode,
    onLoad,
    onError,
    PlaceholderContent,
    transition = true,
    width,
    height,
    ...props
}: PWImageProps) => {
    // const styles = useStyles()

    return (
        <RNEImage
            source={source}
            style={[
                style,
                width ? { width } : undefined,
                height ? { height } : undefined,
            ]}
            containerStyle={containerStyle}
            placeholderStyle={placeholderStyle}
            resizeMode={resizeMode}
            onLoad={onLoad}
            onError={onError}
            PlaceholderContent={PlaceholderContent ?? <ActivityIndicator />}
            transition={transition}
            {...props}
        />
    )
}
