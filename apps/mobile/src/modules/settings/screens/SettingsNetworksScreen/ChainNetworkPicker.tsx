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
import { PWBadge, PWRadioButton, PWText, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import { useChainNetworkPicker } from './useChainNetworkPicker'
import { useStyles } from './styles'

export type ChainNetworkPickerProps = {
    chainId: ChainId
    /** Only worth showing once there is more than one chain to tell apart. */
    isHeaderVisible: boolean
}

export const ChainNetworkPicker = ({
    chainId,
    isHeaderVisible,
}: ChainNetworkPickerProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        displayName,
        networks,
        selectNetwork,
        isNonMainnet,
        selectedLabel,
    } = useChainNetworkPicker(chainId)

    return (
        <PWView testID={`networks_${chainId}_section`}>
            {isHeaderVisible && (
                <PWView style={styles.chainHeader}>
                    <PWText variant='h4'>{displayName}</PWText>
                    {isNonMainnet && (
                        <PWView testID={`networks_${chainId}_tier_badge`}>
                            <PWBadge
                                variant='testnet'
                                value={selectedLabel}
                            />
                        </PWView>
                    )}
                </PWView>
            )}
            <PWView style={styles.container}>
                {networks.map(row => (
                    <PWView
                        key={row.networkId}
                        testID={`networks_${chainId}_${row.networkId}_row`}
                    >
                        <PWRadioButton
                            testID={`networks_${chainId}_${row.networkId}_radio`}
                            title={row.label}
                            onPress={() => void selectNetwork(row.networkId)}
                            isSelected={row.isSelected}
                        />
                    </PWView>
                ))}
            </PWView>
            {isNonMainnet && (
                <InfoCallout
                    title={t(
                        'settings.developer.node_settings.non_mainnet_warning_title',
                    )}
                    body={t(
                        'settings.developer.node_settings.non_mainnet_warning_body',
                    )}
                    style={styles.notice}
                    testID={`networks_${chainId}_non_mainnet_notice`}
                />
            )}
        </PWView>
    )
}
