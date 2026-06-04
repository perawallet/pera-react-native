/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    PWCheckbox,
    PWFlatList,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import {
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import React from 'react'
import {
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { ConnectionViewHeader } from './ConnectionViewHeader'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@perawallet/wallet-core-analytics'

export type ConnectionViewProps = {
    request: WalletConnectSessionRequest
    onSuccess: (request: WalletConnectSessionRequest) => void
    onError: (error?: Error) => void
}

//TODO implement project validation using our backend to show a "verified" badge somewhere
export const ConnectionView = ({
    request,
    onSuccess,
    onError,
}: ConnectionViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { removeSessionRequest } = useWalletConnectSessionRequests()
    const { network } = useNetwork()
    const { approveSession, rejectSession } = useWalletConnect(network)
    const accounts = useSigningAccounts()
    const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([])

    const handleCancel = () => {
        trackEvent(WalletConnectEvent.SessionRejected, {
            [AnalyticsMetadataKey.DappName]: request.peerMeta.name,
            [AnalyticsMetadataKey.DappUrl]: request.peerMeta.url,
        })
        rejectSession(request.clientId)
        removeSessionRequest(request)
    }

    const handleConnect = () => {
        try {
            approveSession(request.clientId, request, selectedAccounts)
            trackEvent(WalletConnectEvent.SessionApproved, {
                [AnalyticsMetadataKey.DappName]: request.peerMeta.name,
                [AnalyticsMetadataKey.DappUrl]: request.peerMeta.url,
                [AnalyticsMetadataKey.AccountAddress]: selectedAccounts[0],
                [AnalyticsMetadataKey.TotalAccount]: selectedAccounts.length,
            })
            onSuccess(request)
            removeSessionRequest(request)
        } catch (error) {
            onError(error as Error)
        }
    }

    const handleAccountPress = (account: WalletAccount) => {
        setSelectedAccounts(prev => {
            if (prev.includes(account.address)) {
                return prev.filter(address => address !== account.address)
            } else {
                return [...prev, account.address]
            }
        })
    }

    const renderAccountRow = ({ item }: { item: WalletAccount }) => {
        return (
            <PWTouchableOpacity
                key={item.address}
                style={styles.accountItem}
                onPress={() => handleAccountPress(item)}
            >
                <AccountDisplay
                    account={item}
                    showChevron={false}
                />
                <PWCheckbox
                    onPress={() => handleAccountPress(item)}
                    checked={selectedAccounts.includes(item.address)}
                />
            </PWTouchableOpacity>
        )
    }

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accounts}
                renderItem={renderAccountRow}
                extraData={{ selectedAccounts }}
                ListHeaderComponent={<ConnectionViewHeader request={request} />}
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={handleCancel}
                    style={styles.cancelButton}
                />
                <PWButton
                    variant='primary'
                    title={t('common.connect.label')}
                    onPress={handleConnect}
                    style={styles.connectButton}
                    isDisabled={!selectedAccounts.length}
                />
            </PWView>
        </>
    )
}
