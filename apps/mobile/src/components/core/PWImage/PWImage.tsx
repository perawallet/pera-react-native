import { Image as RNEImage, ImageProps as RNEImageProps } from '@rneui/themed'

import { ActivityIndicator } from 'react-native'

export type PWImageProps = {
    source: RNEImageProps['source']
    style?: RNEImageProps['style']
    containerStyle?: RNEImageProps['containerStyle']
    placeholderStyle?: RNEImageProps['placeholderStyle']
    resizeMode?: RNEImageProps['resizeMode']
    onLoad?: RNEImageProps['onLoad']
    onError?: RNEImageProps['onError']
    PlaceholderContent?: RNEImageProps['PlaceholderContent']
    transition?: boolean
    width?: number
    height?: number
}

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
}: PWImageProps) => {
    // const styles = useStyles()

    return (
        <RNEImage
            source={source}
            style={[style, width ? { width } : undefined, height ? { height } : undefined]}
            containerStyle={containerStyle}
            placeholderStyle={placeholderStyle}
            resizeMode={resizeMode}
            onLoad={onLoad}
            onError={onError}
            PlaceholderContent={
                PlaceholderContent ?? <ActivityIndicator />
            }
            transition={transition}
        />
    )
}
