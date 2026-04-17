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

import { isAlgoAsset } from '@perawallet/wallet-core-assets'
import { buildPrismUrl, getInitials } from '@perawallet/wallet-core-shared'
import AlgoAssetIcon from '@assets/icons/assets/algo.svg'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SvgProps } from 'react-native-svg'
import { PWIconSize, PWImage, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'

type AssetIconAsset = {
    assetId: string | number
    name?: string
    unitName?: string
    peraMetadata?: {
        logo?: string | null
        collectible?: { primaryImage?: string | null }
    }
}

export type AssetIconProps = {
    asset: AssetIconAsset
    size?: PWIconSize
    /** Direct logo URL — used as-is, bypasses Prism optimization.
     *  Takes precedence over `asset.peraMetadata?.logo`. */
    logoUrl?: string
} & SvgProps

//TODO: we may want a few more "local" asset icons for popular icons (e.g. USDC, DEFLY, etc)
export const AssetIcon = (props: AssetIconProps) => {
    const { asset, size, style, logoUrl, ...rest } = props
    const { theme } = useTheme()
    const [loadFailed, setLoadFailed] = useState(false)

    const sizeMap: Record<PWIconSize, number> = useMemo(
        () => ({
            xs: theme.spacing.md,
            sm: theme.spacing.lg,
            md: theme.spacing.xl,
            lg: theme.spacing.xxl,
            xl: theme.spacing['3xl'],
            xxl: theme.spacing['4xl'],
        }),
        [theme],
    )

    const iconSize = useMemo(() => {
        return sizeMap[size ?? 'md']
    }, [size, sizeMap])

    const styles = useStyles(iconSize)

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
    }, [logoUrl, asset.peraMetadata?.logo, iconSize])

    const hasLogo = Boolean(resolvedLogoUrl) && !loadFailed

    const initials = useMemo(() => {
        return getInitials(asset?.unitName ?? asset?.name ?? '')
    }, [asset?.unitName, asset?.name])

    const icon = useMemo(() => {
        if (!asset) return <></>
        if (isAlgoAsset(asset.assetId))
            return (
                <AlgoAssetIcon
                    {...rest}
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
                <PWText style={styles.initialsText}>{initials}</PWText>
            </PWView>
        )
    }, [
        asset,
        rest,
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

    return <PWView style={[style, styles.container]}>{icon}</PWView>
}
