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

import React from 'react'
import { StyleProp, ViewStyle, ImageStyle } from 'react-native'
import { PWImage, PWView, PWIcon, PWIconSize } from '@components/core'
import { NFT_NOT_OPTED_IN_OPACITY } from '@constants/ui'

export type CollectibleThumbnailProps = {
    thumbnailUrl: string | undefined | null
    imageStyle: StyleProp<ImageStyle>
    placeholderStyle: StyleProp<ViewStyle>
    iconSize: PWIconSize
    notOptedIn?: boolean
}

const notOptedInStyle = { opacity: NFT_NOT_OPTED_IN_OPACITY }

export const CollectibleThumbnail = ({
    thumbnailUrl,
    imageStyle,
    placeholderStyle,
    iconSize,
    notOptedIn = false,
}: CollectibleThumbnailProps) => {
    if (thumbnailUrl) {
        return (
            <PWImage
                source={{ uri: thumbnailUrl }}
                style={[imageStyle, notOptedIn && notOptedInStyle]}
                resizeMode='cover'
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
