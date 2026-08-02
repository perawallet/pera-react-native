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
    buildPrismUrl,
    getInitials,
    isAlgoAssetId,
} from '@perawallet/wallet-core-shared'
import { type DisplayableAsset } from '@perawallet/wallet-core-assets'
import AlgoAssetIcon from '@assets/icons/assets/algo.svg'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type SvgProps } from 'react-native-svg'
import {
    getIconPixelSize,
    type PWIconSize,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'

export type AssetIconProps = {
    asset: DisplayableAsset
    size?: PWIconSize
    /** Direct logo URL — used as-is, bypasses Prism optimization.
     *  Takes precedence over `asset.peraMetadata?.logo`. */
    logoUrl?: string
    /** Icon outline shape. Defaults to 'circle'; collectibles use 'square'. */
    shape?: 'circle' | 'square'
} & SvgProps

//TODO: we may want a few more "local" asset icons for popular icons (e.g. USDC, DEFLY, etc)
export const AssetIcon = (props: AssetIconProps) => {
    const { asset, size, style, logoUrl, shape = 'circle', ...rest } = props
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
        if (isAlgoAssetId(asset.assetId))
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
                <PWText
                    variant='body'
                    style={styles.initialsText}
                >
                    {initials}
                </PWText>
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

    // Hidden from the accessibility tree for the same reason PWIcon is: this
    // renders per row in asset and transaction lists, and TalkBack's node walk
    // over each row is quadratic in the subtree it has to visit. Nothing is
    // lost — every row already states the asset name in text, so the initials
    // fallback would only announce it a second time.
    const decorativeAccessibilityProps =
        rest.accessibilityLabel === undefined
            ? ({
                  accessibilityElementsHidden: true,
                  importantForAccessibility: 'no-hide-descendants',
              } as const)
            : undefined

    return (
        <PWView
            style={[style, styles.container]}
            {...decorativeAccessibilityProps}
        >
            {icon}
        </PWView>
    )
}
