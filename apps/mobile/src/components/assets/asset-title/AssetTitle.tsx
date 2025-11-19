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

import { PeraAsset } from '@perawallet/core'
import PWView from '../../common/view/PWView'
import { useStyles } from './styles'
import AssetIcon from '../../common/asset-icon/AssetIcon'
import { Text, useTheme } from '@rneui/themed'
import { Icon } from '@rneui/base'

export type AssetTitleProps = {
    asset: PeraAsset
}

const AssetTitle = ({ asset }: AssetTitleProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={asset}
                size={theme.spacing.xl * 1.5}
            />
            <Text style={styles.name}>{asset.name}</Text>
            {asset.verificationTier === 'verified' && (
                <Icon
                    name='check-decagram'
                    type='material-community'
                    color={theme.colors.primary}
                    size={16}
                />
            )}
        </PWView>
    )
}

export default AssetTitle
