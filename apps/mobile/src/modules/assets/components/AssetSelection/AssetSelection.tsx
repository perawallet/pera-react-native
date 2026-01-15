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

import { Text } from '@rneui/themed'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWIcon } from '@components/core/PWIcon'

import { AssetIcon } from '../AssetIcon'
import { PeraAsset } from '@perawallet/wallet-core-assets'

export type AssetSelectionProps = {
    asset: PeraAsset
}

export const AssetSelection = ({ asset }: AssetSelectionProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={asset}
                style={styles.icon}
            />
            <Text h4>{asset.unitName}</Text>
            <PWIcon name='chevron-right' />
        </PWView>
    )
}
