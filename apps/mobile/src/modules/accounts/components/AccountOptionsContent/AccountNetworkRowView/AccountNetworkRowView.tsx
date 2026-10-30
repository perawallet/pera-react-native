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

import {
    PWButton,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon, chainUiFor } from '@modules/chain-ui'
import type { AccountChainSectionProps } from '@modules/accounts/types/account-options-display'
import { useStyles } from './styles'
import type {
    AccountNetworkRow,
    UseAccountNetworksResult,
} from '../useAccountNetworks'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: network icon size (40)
const CHAIN_ICON_SIZE = 40

const useNoExpandedSection = (_props: AccountChainSectionProps) => false

export type AccountNetworkRowViewProps = {
    row: AccountNetworkRow
    networks: UseAccountNetworksResult
    onClose: () => void
}

export const AccountNetworkRowView = ({
    row,
    networks,
    onClose,
}: AccountNetworkRowViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { chainId } = row
    const scope = useSelectedScope(chainId)
    const slot = chainUiFor(row.family, chainId).accountOptions
    const sectionProps = { account: networks.account, scope, onClose }
    const useHasExpandedSection =
        slot?.useHasExpandedSection ?? useNoExpandedSection
    const hasSection = useHasExpandedSection(sectionProps)
    const isExpandable = row.isEnabled && hasSection && slot !== undefined
    const isExpanded = isExpandable && networks.expandedChainId === chainId
    const ExpandedSection = slot?.ExpandedSection
    const testID = `account_network_${chainId}`

    return (
        <PWView
            style={styles.networkCard}
            testID={testID}
        >
            <PWView style={styles.networkRow}>
                <ChainIcon
                    chainId={chainId}
                    size={CHAIN_ICON_SIZE}
                />
                <PWView style={styles.networkText}>
                    <PWText
                        variant='h4'
                        truncate
                    >
                        {row.displayName}
                    </PWText>
                    {row.address ? (
                        <PWText
                            variant='caption'
                            style={styles.networkAddress}
                            numberOfLines={1}
                        >
                            {row.address}
                        </PWText>
                    ) : null}
                </PWView>
                {row.isEnabled ? (
                    <PWView style={styles.networkActions}>
                        {row.canShowQr && (
                            <PWTouchableOpacity
                                style={styles.squareButton}
                                onPress={() => networks.handleShowQr(chainId)}
                                accessibilityLabel={t(
                                    'account_options.show_address',
                                )}
                                testID={`${testID}_qr`}
                            >
                                <PWIcon
                                    name='qr'
                                    size='sm'
                                />
                            </PWTouchableOpacity>
                        )}
                        <PWTouchableOpacity
                            style={styles.squareButton}
                            onPress={() => networks.handleCopyAddress(chainId)}
                            accessibilityLabel={t(
                                'account_options.copy_address',
                            )}
                            testID={`${testID}_copy`}
                        >
                            <PWIcon
                                name='copy'
                                size='sm'
                            />
                        </PWTouchableOpacity>
                        {isExpandable && (
                            <PWTouchableOpacity
                                style={styles.squareButton}
                                onPress={() =>
                                    networks.handleToggleExpanded(chainId)
                                }
                                accessibilityLabel={t(
                                    'account_options.network_options',
                                )}
                                accessibilityState={{ expanded: isExpanded }}
                                testID={`${testID}_expand`}
                            >
                                <PWView
                                    style={
                                        isExpanded
                                            ? styles.chevronExpanded
                                            : undefined
                                    }
                                >
                                    <PWIcon
                                        name='chevron-down'
                                        size='sm'
                                    />
                                </PWView>
                            </PWTouchableOpacity>
                        )}
                    </PWView>
                ) : (
                    <PWButton
                        variant='helper'
                        icon='plus'
                        paddingStyle='dense'
                        title={t('account_options.add_network')}
                        isLoading={networks.addingChainId === chainId}
                        isDisabled={
                            networks.addingChainId !== undefined &&
                            networks.addingChainId !== chainId
                        }
                        onPress={() => networks.handleAddNetwork(chainId)}
                        testID={`${testID}_add`}
                    />
                )}
            </PWView>
            {isExpanded && ExpandedSection && (
                <PWView style={styles.expandedSection}>
                    <ExpandedSection {...sectionProps} />
                </PWView>
            )}
        </PWView>
    )
}
