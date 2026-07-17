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
    PWCheckbox,
    PWFlatList,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import {
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSessionRequestExpiredError,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import React from 'react'
import {
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { ConnectionViewHeader } from './ConnectionViewHeader'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    trackEvent,
    WalletConnectEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type ConnectionViewProps = {
    request: WalletConnectSessionRequest
    onSuccess: (request: WalletConnectSessionRequest) => void
    onError: (error?: Error) => void
}

export const ConnectionView = ({
    request,
    onSuccess,
    onError,
}: ConnectionViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const { removeSessionRequest } = useWalletConnectSessionRequests()
    const { network } = useNetwork()
    const { approveSession, rejectSession } = useWalletConnect(network)
    const { errorToast } = useToast()
    const accounts = useSigningAccounts()
    const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([])
    const [isConnecting, setIsConnecting] = React.useState(false)

    const handleCancel = () => {
        trackEvent(WalletConnectEvent.SessionRejected, {
            [AnalyticsMetadataKey.DappName]: request.peerMeta.name,
            [AnalyticsMetadataKey.DappUrl]: request.peerMeta.url,
        })
        // Delivery failures are surfaced (and the request dropped) inside
        // rejectSession — a dead socket must never trap the user here.
        void rejectSession(request.clientId)
        removeSessionRequest(request)
    }

    const handleConnect = async () => {
        setIsConnecting(true)
        try {
            await approveSession(request.clientId, request, selectedAccounts)
            trackEvent(WalletConnectEvent.SessionApproved, {
                [AnalyticsMetadataKey.DappName]: request.peerMeta.name,
                [AnalyticsMetadataKey.DappUrl]: request.peerMeta.url,
                [AnalyticsMetadataKey.AccountAddress]: selectedAccounts[0],
                [AnalyticsMetadataKey.TotalAccount]: selectedAccounts.length,
            })
            onSuccess(request)
            removeSessionRequest(request)
        } catch (error) {
            if (error instanceof WalletConnectSessionRequestExpiredError) {
                onError(error)
                return
            }
            // Delivery failure (dead socket that couldn't be revived):
            // keep the sheet open so Connect can simply be retried.
            errorToast(
                t('walletconnect.request.error_sheet_title'),
                t('walletconnect.connection.approve_delivery_failed'),
            )
        } finally {
            setIsConnecting(false)
        }
    }

    const handleConnectPress = () => void handleConnect()

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
                    onPress={handleConnectPress}
                    style={styles.connectButton}
                    isDisabled={!selectedAccounts.length}
                    isLoading={isConnecting}
                />
            </PWView>
        </>
    )
}
