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

import { useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    useAccountBalancesQuery,
    useSigningAccounts,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import { PWButton, PWFlatList, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from '@modules/walletconnect/components/connection-approval/styles'
import { ConnectionApprovalAccountRow } from './ConnectionApprovalAccountRow'
import { ConnectionApprovalViewHeader } from './ConnectionApprovalViewHeader'
import { useConnectionApprovalView } from './useConnectionApprovalView'

export type ConnectionApprovalViewProps = {
    proposal: ConnectionProposal
}

/**
 * Approves or declines one inbound `ConnectionProposal`. Every action goes
 * through `proposal.approve` / `proposal.reject`, so this screen carries no
 * protocol branching and no registry lookup. `ConnectionView` is the legacy
 * sibling the browser extension still renders.
 */
export const ConnectionApprovalView = ({
    proposal,
}: ConnectionApprovalViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const signingAccounts = useSigningAccounts()
    // Honor the user's account-overview sort order instead of raw store order.
    const { accountBalances } = useAccountBalancesQuery(signingAccounts, true)
    const { sortedAccounts } = useSortedAccounts(
        signingAccounts,
        accountBalances,
    )
    const {
        selectedAccounts,
        isConnecting,
        handleAccountPress,
        handleConnect,
        handleCancel,
    } = useConnectionApprovalView(proposal)

    const renderAccountRow = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <ConnectionApprovalAccountRow
                account={item}
                isSelected={selectedAccounts.includes(item.address)}
                onPress={handleAccountPress}
            />
        ),
        [selectedAccounts, handleAccountPress],
    )

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={sortedAccounts}
                renderItem={renderAccountRow}
                extraData={selectedAccounts}
                ListHeaderComponent={
                    <ConnectionApprovalViewHeader
                        peer={proposal.peer}
                        networks={proposal.requested.networks}
                        methods={proposal.requested.methods}
                    />
                }
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
            <PWView
                style={styles.buttonContainer}
                testID='wc_connection_screen'
            >
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={() => void handleCancel()}
                    style={styles.cancelButton}
                    testID='wc_reject_button'
                />
                <PWButton
                    variant='primary'
                    title={t('common.connect.label')}
                    onPress={() => void handleConnect()}
                    style={styles.connectButton}
                    isDisabled={!selectedAccounts.length}
                    isLoading={isConnecting}
                    testID='wc_connect_button'
                />
            </PWView>
        </>
    )
}
