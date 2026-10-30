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

import { type Nullable } from '@perawallet/wallet-core-shared'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { SvgProps } from 'react-native-svg'
import { type PWIconSize, PWView } from '@components/core'
import { useAssetIcon } from './useAssetIcon'

export type AssetIconProps = {
    asset: DisplayableAsset
    /** The asset's chain; null (no account or chain known) draws it as a token. */
    chainId: Nullable<ChainId>
    size?: PWIconSize
    /** Direct logo URL — used as-is, bypasses Prism optimization.
     *  Takes precedence over `asset.peraMetadata?.logo`. */
    logoUrl?: string
    /** Icon outline shape. Defaults to 'circle'; collectibles use 'square'. */
    shape?: 'circle' | 'square'
} & SvgProps

//TODO: we may want a few more "local" asset icons for popular icons (e.g. USDC, DEFLY, etc)
export const AssetIcon = (props: AssetIconProps) => {
    const {
        asset,
        chainId,
        size,
        style,
        logoUrl,
        shape = 'circle',
        ...rest
    } = props
    const { icon, containerStyle } = useAssetIcon({
        asset,
        chainId,
        size,
        logoUrl,
        shape,
        svgProps: rest,
    })

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
            style={[style, containerStyle]}
            {...decorativeAccessibilityProps}
        >
            {icon}
        </PWView>
    )
}
