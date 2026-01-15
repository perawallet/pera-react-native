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

import { PWView } from '@components/PWView'
import {
    AlgorandChain,
    AlgorandPermission,
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { Image, Text } from '@rneui/themed'
import { useStyles } from './styles'
import { PWBadge } from '@components/PWBadge'
import { useLanguage } from '@hooks/language'
import React from 'react'
import { PWButton } from '@components/PWButton'
import { useWebView } from '@hooks/webview'
import { v7 as uuid } from 'uuid'
import { PWIcon } from '@components/PWIcon'
import {
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { PWCheckbox } from '@components/PWCheckbox'
import { PWTouchableOpacity } from '@components/PWTouchableOpacity'
import { ScrollView } from 'react-native-gesture-handler'
import { useToast } from '@hooks/toast'
import { PermissionItem } from '../PermissionItem'
import { bottomSheetNotifier } from '@components/PWBottomSheet'

//TODO implement project validation using our backend to show a "verified" badge somewhere
export const ConnectionView = ({
    request,
}: {
    request: WalletConnectSessionRequest
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { removeSessionRequest } = useWalletConnectSessionRequests()
    const { approveSession, rejectSession } = useWalletConnect()
    const accounts = useSigningAccounts()
    const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([])
    const { showToast } = useToast()

    const preferredIcon =
        request.peerMeta.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? request.peerMeta.icons?.at(0)

    const handlePressUrl = () => {
        if (!request.peerMeta.url) return
        pushWebView({ id: uuid(), url: request.peerMeta.url })
    }

    const handleCancel = () => {
        rejectSession(request.clientId)
        removeSessionRequest(request)
    }

    const handleConnect = () => {
        if (!selectedAccounts.length) {
            showToast(
                {
                    title: t(
                        'walletconnect.request.accounts_select_one_account_title',
                    ),
                    body: t(
                        'walletconnect.request.accounts_select_one_account_body',
                    ),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
            return
        }
        approveSession(request.clientId, request, selectedAccounts)
        showToast({
            title: t('walletconnect.request.success_title'),
            body: t('walletconnect.request.success_body', {
                name: request.peerMeta.name,
            }),
            type: 'success',
        })
        removeSessionRequest(request)
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

    return (
        <PWView style={styles.container}>
            <PWView style={styles.headerContainer}>
                <PWView style={styles.networksContainer}>
                    {request.chainId !== 4160 ? (
                        <PWBadge
                            value={t(
                                `walletconnect.request.networks_${AlgorandChain[request.chainId]}`,
                            )}
                            variant={
                                request.chainId === 416002
                                    ? 'testnet'
                                    : 'primary'
                            }
                        />
                    ) : (
                        <>
                            <PWBadge
                                value={t(
                                    `walletconnect.request.networks_mainnet`,
                                )}
                                variant='primary'
                            />
                            <PWBadge
                                value={t(
                                    `walletconnect.request.networks_testnet`,
                                )}
                                variant='testnet'
                            />
                        </>
                    )}
                </PWView>
                {preferredIcon ? (
                    <Image
                        source={{ uri: preferredIcon }}
                        style={styles.icon}
                    />
                ) : (
                    <PWView style={styles.iconContainer}>
                        <PWIcon
                            name='wallet-connect'
                            variant='secondary'
                            size='lg'
                        />
                    </PWView>
                )}
                <PWView style={styles.titleContainer}>
                    <Text
                        h3
                        h3Style={styles.title}
                    >
                        {t('walletconnect.request.title', {
                            name: request.peerMeta.name,
                        })}
                    </Text>
                    {!!request.peerMeta.url && (
                        <PWButton
                            variant='link'
                            onPress={handlePressUrl}
                            title={request.peerMeta.url}
                        />
                    )}
                </PWView>
            </PWView>
            <PWView style={styles.permissionsContainer}>
                <Text
                    h4
                    h4Style={styles.permissionsTitle}
                >
                    {t('walletconnect.request.permissions_title')}
                </Text>
                {request.permissions.map((permission, index) => (
                    <PermissionItem
                        key={index}
                        permission={permission as AlgorandPermission}
                    />
                ))}
            </PWView>

            <PWView style={styles.accountSelectionContainer}>
                <Text
                    h4
                    h4Style={styles.permissionsTitle}
                >
                    {t('walletconnect.request.accounts_title')}
                </Text>
                <ScrollView style={styles.accountsContainer}>
                    {accounts.map(account => (
                        <PWTouchableOpacity
                            key={account.address}
                            style={styles.accountItem}
                            onPress={() => handleAccountPress(account)}
                        >
                            <AccountDisplay
                                account={account}
                                showChevron={false}
                            />
                            <PWCheckbox
                                onPress={() => handleAccountPress(account)}
                                checked={selectedAccounts.includes(
                                    account.address,
                                )}
                            />
                        </PWTouchableOpacity>
                    ))}
                </ScrollView>
            </PWView>

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
                />
            </PWView>
        </PWView>
    )
}
