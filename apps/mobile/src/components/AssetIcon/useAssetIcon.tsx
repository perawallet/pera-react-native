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
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactElement,
} from 'react'
import { useTheme } from '@rneui/themed'
import type { StyleProp, ViewStyle } from 'react-native'
import type { SvgProps } from 'react-native-svg'
import {
    buildPrismUrl,
    getInitials,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { nativeAssetIconOf } from '@modules/chain-ui/icon'
import {
    getIconPixelSize,
    type PWIconSize,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type UseAssetIconProps = {
    asset: DisplayableAsset
    chainId: Nullable<ChainId>
    size?: PWIconSize
    logoUrl?: string
    shape?: 'circle' | 'square'
    svgProps: SvgProps
}

export type UseAssetIconResult = {
    icon: ReactElement
    containerStyle: StyleProp<ViewStyle>
}

export const useAssetIcon = ({
    asset,
    chainId,
    size,
    logoUrl,
    shape = 'circle',
    svgProps,
}: UseAssetIconProps): UseAssetIconResult => {
    const { theme } = useTheme()
    const [loadFailed, setLoadFailed] = useState(false)

    const iconSize = getIconPixelSize(theme, size ?? 'md')

    const styles = useStyles({ resolvedSize: iconSize, shape })

    useEffect(() => {
        setLoadFailed(false)
    }, [asset.assetId])

    const handleImageError = useCallback(() => {
        setLoadFailed(true)
    }, [])

    const resolvedLogoUrl = useMemo(() => {
        if (logoUrl) return logoUrl
        const peraLogo =
            asset.peraMetadata?.logo ??
            asset.peraMetadata?.collectible?.primaryImage
        return peraLogo ? buildPrismUrl(peraLogo, iconSize) : null
    }, [
        logoUrl,
        asset.peraMetadata?.logo,
        asset.peraMetadata?.collectible?.primaryImage,
        iconSize,
    ])

    const hasLogo = Boolean(resolvedLogoUrl) && !loadFailed

    const initials = useMemo(() => {
        return getInitials(asset?.unitName ?? asset?.name ?? '')
    }, [asset?.unitName, asset?.name])

    const icon = useMemo(() => {
        if (!asset) return <></>
        const NativeIcon =
            chainId === null
                ? undefined
                : nativeAssetIconOf({ chainId, assetId: asset.assetId })
        if (NativeIcon)
            return (
                <NativeIcon
                    {...svgProps}
                    style={styles.icon}
                    width={iconSize}
                    height={iconSize}
                />
            )

        if (hasLogo) {
            return (
                <PWImage
                    resizeMode='contain'
                    source={{ uri: resolvedLogoUrl! }}
                    style={styles.imageIcon}
                    onError={handleImageError}
                />
            )
        }
        return (
            <PWView style={styles.defaultAsset}>
                <PWText
                    variant='body'
                    style={styles.initialsText}
                >
                    {initials}
                </PWText>
            </PWView>
        )
    }, [
        chainId,
        asset,
        svgProps,
        iconSize,
        styles.icon,
        styles.defaultAsset,
        styles.imageIcon,
        styles.initialsText,
        hasLogo,
        resolvedLogoUrl,
        handleImageError,
        initials,
    ])

    return {icon, containerStyle: styles.container}
}
