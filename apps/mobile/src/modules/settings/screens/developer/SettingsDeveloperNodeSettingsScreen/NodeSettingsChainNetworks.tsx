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
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import { NodeSettingsRow } from './NodeSettingsRow'
import type { NodeSettingsChainSection } from './useSettingsDeveloperNodeSettingsScreen'
import { useStyles } from './styles'

export type NodeSettingsChainNetworksProps = {
    chainSections: NodeSettingsChainSection[]
    onSelect: (chainId: ChainId, networkId: NetworkId) => void
}

export const NodeSettingsChainNetworks = ({
    chainSections,
    onSelect,
}: NodeSettingsChainNetworksProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.chainNetworks}
            testID='node_settings_chain_networks'
        >
            {chainSections.map(section => (
                <PWView
                    key={section.chainId}
                    style={styles.chainSection}
                    testID={`node_settings_chain_${section.chainId}`}
                >
                    {/* With one chain the heading would only repeat the screen's subject. */}
                    {chainSections.length > 1 && (
                        <PWText variant='h4'>{section.chainName}</PWText>
                    )}
                    {section.networks.map(row => (
                        <NodeSettingsRow
                            key={row.networkId}
                            chainId={section.chainId}
                            row={row}
                            onSelect={() =>
                                onSelect(section.chainId, row.networkId)
                            }
                        />
                    ))}
                </PWView>
            ))}
        </PWView>
    )
}
