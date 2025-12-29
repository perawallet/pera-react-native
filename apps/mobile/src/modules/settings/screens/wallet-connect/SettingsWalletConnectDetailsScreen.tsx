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

import PWButton from '@components/button/PWButton'
import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'
import { useModalState } from '@hooks/modal-state'
import {
    AlgorandPermission,
    useWalletConnect,
} from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './SettingsWalletConnectDetailsScreen.styles'
import { Dialog, Image, Text, useTheme } from '@rneui/themed'
import { useMemo, useState } from 'react'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { WalletConnectSettingsStackParamsList } from '@modules/settings/routes'
import { useWebView } from '@hooks/webview'
import { v7 as uuid } from 'uuid'
import PWBadge from '@components/badge/PWBadge'
import RowTitledItem from '@components/row-titled-item/RowTitledItem'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import AccountDisplay from '@modules/accounts/components/account-display/AccountDisplay'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import PWIcon from '@components/icons/PWIcon'
import { ScrollView } from 'react-native-gesture-handler'
import { ExpandablePanel } from '@components/expandable-panel/ExpandablePanel'
import PWBottomSheet from '@components/bottom-sheet/PWBottomSheet'
import PermissionItem from '@modules/walletconnect/components/permission-item/PermissionItem'
import { useNavigation } from '@react-navigation/native'

type SettingsWalletConnectDetailsScreenProps = NativeStackScreenProps<
    WalletConnectSettingsStackParamsList,
    'WalletConnectSettingsDetails'
>

const ConnectedNetworks = ({ chainId }: { chainId: number }) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.networkContainer}>
            {(chainId === 4160 || chainId === 416001) && (
                <Text style={styles.mainnetText}>
                    {t(`walletconnect.request.networks_mainnet`)}
                </Text>
            )}
            {(chainId === 4160 || chainId === 416002) && (
                <Text style={styles.testnetText}>
                    {t(`walletconnect.request.networks_testnet`)}
                </Text>
            )}
        </PWView>
    )
}

const SettingsWalletConnectDetailsScreen = ({
    route,
}: SettingsWalletConnectDetailsScreenProps) => {
    const { t } = useLanguage()
    const { disconnectSession } = useWalletConnect()
    const deleteState = useModalState()
    const infoState = useModalState()
    const styles = useStyles()
    const { theme } = useTheme()
    const [loading, setLoading] = useState(false)
    const { pushWebView } = useWebView()
    const navigation = useNavigation()
    const accounts = useAllAccounts()

    const { session } = route.params
    const connectedAccounts = useMemo(() => {
        return session?.session?.accounts?.map(address =>
            accounts.find(account => account.address === address),
        )
    }, [session, accounts])

    const preferredIcon =
        session?.session?.peerMeta?.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg') ||
                icon.endsWith('.gif'),
        ) ?? session?.session?.peerMeta?.icons?.[0]

    const handleDelete = () => {
        if (!session.clientId) {
            deleteState.close()
            return
        }
        setLoading(true)
        disconnectSession(session.clientId, true)
            .then(() => {
                deleteState.close()
            })
            .finally(() => {
                setLoading(false)
                navigation.goBack()
            })
    }

    const handleOpenLink = () => {
        if (!session.session?.peerMeta?.url) {
            return
        }
        pushWebView({ id: uuid(), url: session.session.peerMeta.url })
    }

    const peerMeta = session.session?.peerMeta

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {!!preferredIcon && (
                <Image
                    source={{ uri: preferredIcon }}
                    style={styles.icon}
                />
            )}
            {!preferredIcon && (
                <PWIcon
                    name='wallet-connect'
                    size='lg'
                />
            )}
            <Text h4>{peerMeta?.name ?? 'Unknown'}</Text>
            {peerMeta?.url && (
                <PWTouchableOpacity onPress={handleOpenLink}>
                    <Text style={styles.link}>{peerMeta?.url}</Text>
                </PWTouchableOpacity>
            )}
            {peerMeta?.description && (
                <Text style={styles.description}>{peerMeta?.description}</Text>
            )}
            <PWView style={styles.versionContainer}>
                <PWBadge
                    variant='secondary'
                    value={`WCV${session?.version}`}
                />
                <Text style={styles.version}>
                    {t('walletconnect.settings.version', {
                        version: session?.version,
                    })}
                </Text>
            </PWView>
            <PWView style={styles.connectionContainer}>
                <RowTitledItem
                    title={t('walletconnect.settings.created_at', { date: '' })}
                >
                    <Text style={styles.createdAt}>
                        {formatDatetime(
                            session?.createdAt ?? new Date(),
                            undefined,
                            'medium',
                        )}
                    </Text>
                </RowTitledItem>
            </PWView>
            {!!connectedAccounts?.length && (
                <PWView style={styles.accountContainer}>
                    <Text>
                        {t('walletconnect.settings.connected_accounts')}
                    </Text>
                    {connectedAccounts.map(account => (
                        <PWView
                            style={styles.accountRow}
                            key={account?.id}
                        >
                            <AccountDisplay
                                account={account}
                                showChevron={false}
                                style={styles.accountDisplay}
                            />
                            <ConnectedNetworks
                                chainId={session.session?.chainId ?? 4160}
                            />
                        </PWView>
                    ))}
                </PWView>
            )}
            <ExpandablePanel
                title={
                    <PWView style={styles.permissionsTitle}>
                        <Text>{t('walletconnect.settings.permissions')}</Text>
                        <PWIcon
                            name='info'
                            size='sm'
                            onPress={infoState.open}
                        />
                    </PWView>
                }
            >
                <PWView style={styles.permissionsContainer}>
                    {session.session?.permissions?.map((permission, index) => (
                        <PermissionItem
                            key={index}
                            permission={permission as AlgorandPermission}
                        />
                    ))}
                </PWView>
            </ExpandablePanel>

            <PWView style={styles.deleteContainer}>
                <PWButton
                    variant='secondary'
                    title={t('walletconnect.settings.delete_title')}
                    onPress={deleteState.open}
                />
            </PWView>
            <Dialog
                isVisible={deleteState.isOpen}
                onBackdropPress={deleteState.close}
            >
                <Dialog.Title
                    title={t('walletconnect.settings.delete_title')}
                />
                <Text>{t('walletconnect.settings.delete_body')}</Text>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.error }}
                        onPress={handleDelete}
                        disabled={loading}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteState.close}
                        disabled={loading}
                    />
                </Dialog.Actions>
            </Dialog>
            <PWBottomSheet isVisible={infoState.isOpen}>
                <PWView style={styles.infoSheet}>
                    <Text h3>
                        {t('walletconnect.settings.permissions_info_title')}
                    </Text>
                    <Text>
                        {t('walletconnect.settings.permissions_info_body')}
                    </Text>
                    <PWButton
                        variant='secondary'
                        title={t('common.close.label')}
                        onPress={infoState.close}
                    />
                </PWView>
            </PWBottomSheet>
        </ScrollView>
    )
}

export default SettingsWalletConnectDetailsScreen
