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

import { useStyles } from './styles'
import { PWView } from '@components/core/PWView'
import { ViewStyle } from 'react-native'
import { Text } from '@rneui/themed'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { PeraAsset } from '@perawallet/wallet-core-assets'

type SwapPairItemProps = {
    fromAsset: PeraAsset
    toAsset: PeraAsset
    style: ViewStyle
}

export const SwapPair = (props: SwapPairItemProps) => {
    const themeStyle = useStyles()

    return (
        <PWView style={props.style}>
            <PWView style={themeStyle.itemIconContainer}>
                <AssetIcon
                    asset={props.fromAsset}
                    style={themeStyle.fromIcon}
                />
                <AssetIcon
                    asset={props.toAsset}
                    style={themeStyle.toIcon}
                />
            </PWView>
            <Text h4>
                {props.fromAsset?.unitName} to {props.toAsset?.unitName}
            </Text>
        </PWView>
    )
}
