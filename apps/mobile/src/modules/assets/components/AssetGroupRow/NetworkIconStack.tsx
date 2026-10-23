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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { useNetworkIcon } from '../NetworkIconProvider'
import { useNetworkIconStack } from './useNetworkIconStack'
import { NETWORK_ICON_SIZE, useStyles } from './styles'

export type NetworkIconStackProps = {
    chainIds: ChainId[]
}

export const NetworkIconStack = ({ chainIds }: NetworkIconStackProps) => {
    const styles = useStyles()
    const NetworkIcon = useNetworkIcon()
    const { visibleChainIds, hiddenCount } = useNetworkIconStack(chainIds)

    return (
        <PWView style={styles.networkStack}>
            {visibleChainIds.map((chainId, index) => (
                <PWView
                    key={chainId}
                    testID={`network_icon_${chainId}`}
                    style={[
                        styles.networkIcon,
                        index > 0 ? styles.stackedNetworkIcon : undefined,
                    ]}
                >
                    <NetworkIcon
                        chainId={chainId}
                        size={NETWORK_ICON_SIZE}
                    />
                </PWView>
            ))}
            {hiddenCount > 0 && (
                <PWView
                    style={[styles.moreNetworks, styles.stackedNetworkIcon]}
                    testID='network_icon_stack_more'
                >
                    <PWText
                        variant='captionMedium'
                        style={styles.moreNetworksLabel}
                    >
                        {`+${hiddenCount}`}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
