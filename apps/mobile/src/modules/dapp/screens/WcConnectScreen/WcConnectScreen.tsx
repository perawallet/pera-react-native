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

// approve/reject travel over the approval bridge, not a connector this surface
// may not own. Imports ConnectionApprovalView's stylesheet; the deliberate
// differences are no `inBottomSheet` on the list and the verified-requester row.
import React from 'react'
import {
    PWButton,
    PWFlatList,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { SiteSafetyGate } from '@modules/site-safety'
import {
    ConnectAccountRow,
    ConnectionApprovalAccountRow,
} from '@modules/walletconnect'
import { useStyles } from '@components/ConnectionApproval/styles'
import { useStyles as useLocalStyles } from './styles'
import { WcConnectHeader } from './WcConnectHeader'
import { useWcConnectScreen } from './useWcConnectScreen'

export const WcConnectScreen = (): React.JSX.Element => {
    const styles = useStyles()
    const localStyles = useLocalStyles()
    const { t } = useLanguage()
    const {
        peer,
        peerName,
        permissions,
        requesterOriginLabel,
        isRequesterOriginDistinct,
        chainId,
        chainNetwork,
        verificationTier,
        accounts,
        selected,
        toggle,
        isEvm,
        evmAccount,
        handleEvmAccountPress,
        isArmed,
        canConnect,
        isLoading,
        isConnecting,
        isConfirmed,
        handleConnect,
        handleCancel,
        peerUrlLabel,
        canOpenPeerUrl,
        handlePressUrl,
        deliveryError,
        siteSafety,
        noAccountsNote,
    } = useWcConnectScreen()

    const renderAccountRow = ({
        item,
    }: {
        item: WalletAccount
    }): React.JSX.Element => (
        <ConnectionApprovalAccountRow
            account={item}
            chainId={chainId}
            isSelected={selected.has(item.id)}
            onPress={toggle}
        />
    )

    if (isLoading || !peer) {
        return <FullScreenLoadingView />
    }

    return (
        <PWScreen scroll='never'>
            <SiteSafetyGate
                gate={siteSafety}
                onReject={handleCancel}
            >
                <PWFlatList
                    style={styles.container}
                    contentContainerStyle={styles.contentContainer}
                    data={isEvm ? [] : accounts}
                    renderItem={renderAccountRow}
                    extraData={{ selected }}
                    ListHeaderComponent={
                        <WcConnectHeader
                            peer={peer}
                            peerName={peerName}
                            permissions={permissions}
                            chainNetwork={chainNetwork}
                            verificationTier={verificationTier}
                            requesterOriginLabel={requesterOriginLabel}
                            isRequesterOriginDistinct={
                                isRequesterOriginDistinct
                            }
                            peerUrlLabel={peerUrlLabel}
                            canOpenPeerUrl={canOpenPeerUrl}
                            onPressUrl={handlePressUrl}
                            evmAccountRow={
                                isEvm && accounts.length > 0 ? (
                                    <ConnectAccountRow
                                        account={evmAccount}
                                        chainId={chainId}
                                        labelKey='connect'
                                        onPress={() =>
                                            void handleEvmAccountPress()
                                        }
                                        isDisabled={!isArmed}
                                        testID='wc_evm_account_row'
                                    />
                                ) : undefined
                            }
                        />
                    }
                    ListEmptyComponent={
                        // An EVM chain lists nothing: its accounts are in the row.
                        isEvm && accounts.length > 0 ? null : (
                            <PWText
                                style={styles.noAccounts}
                                testID='dapp_connect_no_accounts'
                            >
                                {noAccountsNote}
                            </PWText>
                        )
                    }
                    showsVerticalScrollIndicator={false}
                />
                {deliveryError && (
                    <PWText
                        variant='caption'
                        style={localStyles.deliveryError}
                        testID='wc-connect-delivery-error'
                    >
                        {t('dapp.approval.delivery_failed')}
                    </PWText>
                )}
                <PWView style={styles.buttonContainer}>
                    <PWButton
                        variant='secondary'
                        title={t('common.cancel.label')}
                        onPress={handleCancel}
                        style={styles.cancelButton}
                        isDisabled={isConfirmed}
                        testID='wc-connect-cancel'
                    />
                    <PWButton
                        variant='primary'
                        title={
                            isConfirmed ? undefined : t('common.connect.label')
                        }
                        icon={isConfirmed ? 'check' : undefined}
                        onPress={handleConnect}
                        style={styles.connectButton}
                        isDisabled={!canConnect}
                        isLoading={isConnecting}
                        testID='wc-connect-connect'
                    />
                </PWView>
            </SiteSafetyGate>
        </PWScreen>
    )
}
