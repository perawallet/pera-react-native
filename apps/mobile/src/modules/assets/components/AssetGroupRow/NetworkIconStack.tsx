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

import { PWText, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useNetworkIconStack } from './useNetworkIconStack'
import { useStyles } from './styles'

export type NetworkIconStackProps = {
    chainIds: ChainId[]
}

// The app ships no chain logos, so each network shows its native asset's icon.
export const NetworkIconStack = ({ chainIds }: NetworkIconStackProps) => {
    const styles = useStyles()
    const { visibleChainIds, hiddenCount } = useNetworkIconStack(chainIds)

    return (
        <PWView style={styles.networkStack}>
            {visibleChainIds.map((chainId, index) => (
                <PWView
                    key={chainId}
                    testID={`network_icon_${chainId}`}
                    style={index > 0 ? styles.stackedNetworkIcon : undefined}
                >
                    <AssetIcon
                        asset={nativeAssetFor(chainId)}
                        size='xs'
                    />
                </PWView>
            ))}
            {hiddenCount > 0 && (
                <PWText
                    variant='caption'
                    style={styles.subtitle}
                    testID='network_icon_stack_more'
                >
                    {`+${hiddenCount}`}
                </PWText>
            )}
        </PWView>
    )
}
