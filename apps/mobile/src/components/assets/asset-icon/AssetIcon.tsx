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

import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg'
import { useMemo } from 'react'
import { SvgProps } from 'react-native-svg'
import { Image, Text } from '@rneui/themed'
import PWView from '../../common/view/PWView'
import { useStyles } from './styles'

export type AssetIconProps = {
    asset: PeraAsset
    size?: number
} & SvgProps

//TODO: we may want a few more "local" asset icons for popular icons (e.g. USDC, DEFLY, etc)
const AssetIcon = (props: AssetIconProps) => {
    const { asset, size, style, ...rest } = props
    const styles = useStyles(props)

    const icon = useMemo(() => {
        if (!asset) return <></>
        if (asset.assetId === ALGO_ASSET_ID)
            return (
                <AlgoAssetIcon
                    {...rest}
                    style={styles.icon}
                    width={size}
                    height={size}
                />
            )
        if (asset.peraMetadata?.logo) {
            return (
                <Image
                    resizeMode='contain'
                    source={{ uri: asset.peraMetadata?.logo }}
                    style={styles.icon}
                    width={size}
                    height={size}
                />
            )
        }
        return (
            <PWView style={styles.defaultAsset}>
                <Text>{asset?.unitName?.slice(0, 1)}</Text>
            </PWView>
        )
    }, [asset, rest, size, styles.icon, styles.defaultAsset])

    return <PWView style={[style, styles.container]}>{icon}</PWView>
}

export default AssetIcon
