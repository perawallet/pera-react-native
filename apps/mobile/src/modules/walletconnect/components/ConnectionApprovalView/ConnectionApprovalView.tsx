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
import type { ConnectionProposal } from '@perawallet/wallet-core-connections'
import { PWButton, PWFlatList, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SiteSafetyGate } from '@modules/site-safety'
import { useStyles } from '@components/ConnectionApproval/styles'
import { ConnectionApprovalAccountRow } from './ConnectionApprovalAccountRow'
import { ConnectionApprovalViewHeader } from './ConnectionApprovalViewHeader'
import {
    useConnectionApprovalView,
    type ConnectionAccountRow,
} from './useConnectionApprovalView'

const accountRowKey = (row: ConnectionAccountRow) => row.account.id

export type ConnectionApprovalViewProps = {
    proposal: ConnectionProposal
}

export const ConnectionApprovalView = ({
    proposal,
}: ConnectionApprovalViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const {
        accountRows,
        title,
        requestedNetworks,
        handleAddNetwork,
        permissions,
        isOriginVerified,
        selectedAccounts,
        isConnecting,
        handleAccountPress,
        handleConnect,
        handleCancel,
        peerUrlLabel,
        canOpenPeerUrl,
        handlePressUrl,
        noAccountsNote,
        originWarning,
        verifiedOriginLabel,
        siteSafety,
    } = useConnectionApprovalView(proposal)

    const renderAccountRow = useCallback(
        ({ item }: { item: ConnectionAccountRow }) => (
            <ConnectionApprovalAccountRow
                account={item.account}
                chainId={item.chainId}
                isSelected={selectedAccounts.includes(item.account.id)}
                onPress={handleAccountPress}
            />
        ),
        [selectedAccounts, handleAccountPress],
    )

    return (
        <SiteSafetyGate
            gate={siteSafety}
            onReject={() => void handleCancel()}
        >
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accountRows}
                keyExtractor={accountRowKey}
                renderItem={renderAccountRow}
                extraData={selectedAccounts}
                ListHeaderComponent={
                    <ConnectionApprovalViewHeader
                        peer={proposal.peer}
                        title={title}
                        requestedNetworks={requestedNetworks}
                        onAddNetwork={handleAddNetwork}
                        permissions={permissions}
                        isOriginVerified={isOriginVerified}
                        peerUrlLabel={peerUrlLabel}
                        canOpenPeerUrl={canOpenPeerUrl}
                        onPressUrl={handlePressUrl}
                        originWarning={originWarning}
                        verifiedOriginLabel={verifiedOriginLabel}
                        hasSiteWarning={siteSafety.verdict.kind !== 'clear'}
                    />
                }
                ListEmptyComponent={
                    <PWText
                        style={styles.noAccounts}
                        testID='wc_connection_no_accounts'
                    >
                        {noAccountsNote}
                    </PWText>
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
                    isDisabled={
                        !selectedAccounts.length ||
                        !siteSafety.isApprovalAllowed
                    }
                    isLoading={isConnecting}
                    testID='wc_connect_button'
                />
            </PWView>
        </SiteSafetyGate>
    )
}
