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

import { useTheme } from '@rneui/themed'
import {
    PWButton,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useInfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon, chainUiFor } from '@modules/chain-ui'
import type { AccountChainSectionProps } from '../../types/account-options-display'
import { AccountTypeInfoContent } from '../AccountInfoCard/AccountTypeInfoContent'
import { useStyles } from './styles'
import type {
    AccountNetworkRow,
    UseAccountNetworksResult,
} from './useAccountNetworks'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: network icon size (40)
const CHAIN_ICON_SIZE = 40

const useNoExpandedSection = (_props: AccountChainSectionProps) => false

type AccountNetworkRowViewProps = {
    row: AccountNetworkRow
    networks: UseAccountNetworksResult
    onClose: () => void
}

const AccountNetworkRowView = ({
    row,
    networks,
    onClose,
}: AccountNetworkRowViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { chainId } = row
    const scope = useSelectedScope(chainId)
    const slot = chainUiFor(row.family).accountOptions
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

type UnreachableChainsNoteRowProps = {
    note: string
    account: WalletAccount
}

const UnreachableChainsNoteRow = ({
    note,
    account,
}: UnreachableChainsNoteRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { openInfo } = useInfoButton({
        children: <AccountTypeInfoContent account={account} />,
    })

    return (
        <PWView
            style={styles.unreachableNote}
            testID='account_networks_unreachable_note'
        >
            <PWText
                variant='caption'
                style={styles.unreachableNoteText}
            >
                {note}
            </PWText>
            <PWTouchableOpacity
                onPress={openInfo}
                testID='account_networks_unreachable_learn_more'
            >
                <PWText variant='link'>
                    {t('account_type_info.learn_more')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}

export type AccountNetworkListProps = {
    networks: UseAccountNetworksResult
    onClose: () => void
}

export const AccountNetworkList = ({
    networks,
    onClose,
}: AccountNetworkListProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.networkList}>
            {networks.visibleRows.map(row => (
                <AccountNetworkRowView
                    key={row.chainId}
                    row={row}
                    networks={networks}
                    onClose={onClose}
                />
            ))}
            {networks.hiddenRows.length > 0 && (
                <PWTouchableOpacity
                    style={styles.seeAllButton}
                    onPress={networks.handleShowAllNetworks}
                    testID='account_networks_see_all'
                >
                    <PWView style={styles.chainIconStack}>
                        {networks.hiddenRows.map((row, index) => (
                            <PWView
                                key={row.chainId}
                                style={index > 0 && styles.stackedChainIcon}
                            >
                                <ChainIcon
                                    chainId={row.chainId}
                                    size={theme.spacing.lg}
                                />
                            </PWView>
                        ))}
                    </PWView>
                    <PWText variant='h4'>
                        {t('account_options.see_all_networks')}
                    </PWText>
                    <PWIcon
                        name='chevron-down'
                        size='sm'
                    />
                </PWTouchableOpacity>
            )}
            {networks.unreachableChainsNote && (
                <UnreachableChainsNoteRow
                    note={networks.unreachableChainsNote}
                    account={networks.account}
                />
            )}
        </PWView>
    )
}
