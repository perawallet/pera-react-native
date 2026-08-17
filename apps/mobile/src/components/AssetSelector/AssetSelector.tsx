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

import { useMemo } from 'react'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import {
    useAssetsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { type Optional } from '@perawallet/wallet-core-shared'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { useStyles } from './styles'

type AssetSelectorVariant = 'pay' | 'receive'

type AssetSelectorBaseProps = {
    variant: AssetSelectorVariant
    onPress: () => void
    testID?: string
}

export type AssetSelectorProps = AssetSelectorBaseProps &
    (
        | {
              assetId: string
              /** Label shown when the asset has no resolvable unit name. */
              fallbackLabel?: string
          }
        | {
              /** Pre-resolved asset, bypassing `useAssetsQuery`. */
              asset: Optional<DisplayableAsset>
              /** Label shown next to the icon (e.g. token symbol). */
              label: string
              /** Direct logo URL, forwarded to `AssetIcon`. */
              logoUrl?: string
          }
    )

type AssetSelectorContentProps = AssetSelectorBaseProps & {
    asset: Optional<DisplayableAsset>
    label: string
    logoUrl?: string
}

const AssetSelectorContent = ({
    variant,
    onPress,
    testID,
    asset,
    label,
    logoUrl,
}: AssetSelectorContentProps) => {
    const styles = useStyles({ variant })

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.content}>
                {asset ? (
                    <>
                        <AssetIcon
                            asset={asset}
                            logoUrl={logoUrl}
                            style={styles.icon}
                            size='lg'
                        />
                        <PWText
                            variant='h4'
                            truncate
                            style={styles.assetName}
                        >
                            {label}
                        </PWText>
                    </>
                ) : (
                    // Placeholder is a CTA phrase; shrink it to fit rather than
                    // ellipsize ("Choose an asset" clips to "Choose an ass…").
                    <PWText
                        variant='h4'
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={styles.assetName}
                    >
                        {label}
                    </PWText>
                )}
                <PWIcon name='chevron-right' />
            </PWView>
        </PWTouchableOpacity>
    )
}

type AssetSelectorByIdProps = AssetSelectorBaseProps & {
    assetId: string
    fallbackLabel?: string
}

const AssetSelectorById = ({
    assetId,
    fallbackLabel,
    ...rest
}: AssetSelectorByIdProps) => {
    const { data: assets } = useAssetsQuery([assetId])
    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])

    return (
        <AssetSelectorContent
            {...rest}
            asset={asset}
            label={asset?.unitName ?? fallbackLabel ?? ''}
        />
    )
}

export const AssetSelector = (props: AssetSelectorProps) => {
    if ('assetId' in props) {
        return <AssetSelectorById {...props} />
    }

    return <AssetSelectorContent {...props} />
}
