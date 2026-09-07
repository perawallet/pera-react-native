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
import type { StyleProp, ViewStyle, ImageStyle } from 'react-native'
import { PWImage, PWView, PWIcon, type PWIconSize } from '@components/core'
import { NFT_NOT_OPTED_IN_OPACITY } from '@constants/ui'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useCollectibleThumbnail } from './useCollectibleThumbnail'

export type CollectibleThumbnailProps = {
    thumbnailUrl: Maybe<string>
    imageStyle: StyleProp<ImageStyle>
    placeholderStyle: StyleProp<ViewStyle>
    iconSize: PWIconSize
    notOptedIn?: boolean
    /** Target width in physical pixels; when set, the CDN resizes via Prism query params. */
    imageWidth?: number
}

const notOptedInStyle = { opacity: NFT_NOT_OPTED_IN_OPACITY }

export const CollectibleThumbnail = ({
    thumbnailUrl,
    imageStyle,
    placeholderStyle,
    iconSize,
    notOptedIn = false,
    imageWidth,
}: CollectibleThumbnailProps) => {
    const { imageUrl, showPlaceholder, handleImageError } =
        useCollectibleThumbnail({ thumbnailUrl, imageWidth })

    if (!showPlaceholder) {
        return (
            <PWImage
                source={{ uri: imageUrl }}
                style={[imageStyle, notOptedIn && notOptedInStyle]}
                resizeMode='cover'
                onError={handleImageError}
            />
        )
    }

    return (
        <PWView style={[placeholderStyle, notOptedIn && notOptedInStyle]}>
            <PWIcon
                name='card-stack'
                size={iconSize}
            />
        </PWView>
    )
}
