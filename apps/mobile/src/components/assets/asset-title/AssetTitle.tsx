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

import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/core'
import PWView from '../../common/view/PWView'
import PWIcon from '../../common/icons/PWIcon'
import { useStyles } from './styles'
import AssetIcon from '../asset-icon/AssetIcon'
import { Text, useTheme } from '@rneui/themed'
import { useMemo } from 'react'

export type AssetTitleProps = {
    asset: PeraAsset
}

const AssetTitle = ({ asset }: AssetTitleProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    const isAlgo = useMemo(
        () => asset.asset_id === ALGO_ASSET_ID,
        [asset.asset_id],
    )

    return (
        <PWView style={styles.container}>
            <AssetIcon
                asset={asset}
                size={theme.spacing.xl * 1.5}
            />
            <Text style={styles.name}>{asset.name}</Text>
            {isAlgo && (
                <PWIcon
                    name='assets/trusted'
                    size={'sm'}
                />
            )}
            {!isAlgo && asset.verification_tier === 'verified' && (
                <PWIcon
                    name='assets/verified'
                    size={'sm'}
                />
            )}
            {!isAlgo && asset.verification_tier === 'suspicious' && (
                <PWIcon
                    name='assets/suspicious'
                    size={'sm'}
                />
            )}
        </PWView>
    )
}

export default AssetTitle
