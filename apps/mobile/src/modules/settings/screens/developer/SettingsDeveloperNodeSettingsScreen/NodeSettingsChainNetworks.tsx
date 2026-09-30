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

import { PWBadge, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { ChainNetworkSummary } from './useSettingsDeveloperNodeSettingsScreen'
import { useStyles } from './styles'

export type NodeSettingsChainNetworksProps = {
    chainNetworks: ChainNetworkSummary[]
}

export const NodeSettingsChainNetworks = ({
    chainNetworks,
}: NodeSettingsChainNetworksProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.chainNetworks}
            testID='node_settings_chain_networks'
        >
            <PWText variant='h4'>
                {t('settings.developer.node_settings.chain_networks_title')}
            </PWText>
            {chainNetworks.map(chain => (
                <PWView
                    key={chain.chainId}
                    style={styles.chainNetworkRow}
                    testID={`node_settings_chain_${chain.chainId}`}
                >
                    <PWText variant='body'>{chain.chainName}</PWText>
                    {/* RNEUI's Badge drops testID, so the wrapper carries it. */}
                    <PWView
                        testID={`node_settings_chain_${chain.chainId}_badge`}
                    >
                        <PWBadge
                            variant={chain.isMainnet ? 'secondary' : 'testnet'}
                            value={chain.networkLabel}
                        />
                    </PWView>
                </PWView>
            ))}
        </PWView>
    )
}
