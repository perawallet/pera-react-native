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
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useStyles as useSharedStyles } from '@components/ConnectionApproval/styles'
import { useLanguage } from '@hooks/useLanguage'
import type { RequestedNetwork } from '../useConnectionApprovalView'
import { RequestedNetworkChip } from '../RequestedNetworkChip'
import { RequestedNetworkListItem } from '../RequestedNetworkListItem'
import { useRequestedNetworksPanel } from './useRequestedNetworksPanel'
import { useStyles } from './styles'

type RequestedNetworksPanelProps = {
    requestedNetworks: RequestedNetwork[]
    /** Cleaned dApp name, for the optional note. */
    peerName: string
    onAddNetwork: (chainId: ChainId) => void
}

export const RequestedNetworksPanel = ({
    requestedNetworks,
    peerName,
    onAddNetwork,
}: RequestedNetworksPanelProps) => {
    const sharedStyles = useSharedStyles()
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        addedNetworks,
        optionalNetworks,
        collapsedNetworks,
        hiddenNetworkCount,
        isInitiallyExpanded,
        hasOptionalNote,
    } = useRequestedNetworksPanel(requestedNetworks)

    return (
        <TitledExpandablePanel
            hasVerticalChevron
            startExpanded={isInitiallyExpanded}
            containerStyle={sharedStyles.panelContainer}
            testID='wc_requested_networks_toggle'
            title={
                <PWView style={styles.summary}>
                    <PWText
                        variant='h4'
                        style={sharedStyles.panelTitle}
                    >
                        {t('walletconnect.request.networks_heading')}
                    </PWText>
                    <PWView style={styles.chips}>
                        {collapsedNetworks.map(network => (
                            <RequestedNetworkChip
                                key={network.chainId}
                                network={network}
                            />
                        ))}
                        {hiddenNetworkCount > 0 && (
                            <PWText
                                variant='caption'
                                style={styles.moreText}
                                testID='wc_requested_networks_more'
                            >
                                {t('walletconnect.request.networks_more', {
                                    count: hiddenNetworkCount,
                                })}
                            </PWText>
                        )}
                    </PWView>
                </PWView>
            }
        >
            <PWView style={sharedStyles.panelContent}>
                {addedNetworks.map(network => (
                    <RequestedNetworkListItem
                        key={network.chainId}
                        network={network}
                        onAdd={onAddNetwork}
                    />
                ))}
                {hasOptionalNote && (
                    <PWText
                        variant='caption'
                        style={styles.optionalNote}
                        testID='wc_requested_networks_optional_note'
                    >
                        {t('walletconnect.request.networks_optional_note', {
                            name: peerName,
                        })}
                    </PWText>
                )}
                {optionalNetworks.map(network => (
                    <RequestedNetworkListItem
                        key={network.chainId}
                        network={network}
                        onAdd={onAddNetwork}
                    />
                ))}
            </PWView>
        </TitledExpandablePanel>
    )
}
