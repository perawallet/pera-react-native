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
    PWBadge,
    PWButton,
    PWIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import {
    AlgorandPermission,
    useWalletConnect,
} from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { Dialog, Image, Text, useTheme } from '@rneui/themed'
import { useMemo, useState } from 'react'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { WalletConnectSettingsStackParamsList } from '@modules/settings/routes'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v7 as uuid } from 'uuid'
import { RowTitledItem } from '@components/RowTitledItem'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { ScrollView } from 'react-native-gesture-handler'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'
import { useNavigation } from '@react-navigation/native'
import { InfoButton } from '@components/InfoButton'

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

export const SettingsWalletConnectDetailsScreen = ({
    route,
}: SettingsWalletConnectDetailsScreenProps) => {
    const { t } = useLanguage()
    const { disconnect } = useWalletConnect()
    const deleteState = useModalState()
    const styles = useStyles()
    const { theme } = useTheme()
    const [isLoading, setIsLoading] = useState(false)
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
        setIsLoading(true)
        disconnect(session.clientId, true)
            .then(() => {
                deleteState.close()
            })
            .finally(() => {
                setIsLoading(false)
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
            <TitledExpandablePanel
                title={
                    <PWView style={styles.permissionsTitle}>
                        <Text>{t('walletconnect.settings.permissions')}</Text>
                        <InfoButton
                            size='sm'
                            title={t(
                                'walletconnect.settings.permissions_info_title',
                            )}
                        >
                            <Text>
                                {t(
                                    'walletconnect.settings.permissions_info_body',
                                )}
                            </Text>
                        </InfoButton>
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
            </TitledExpandablePanel>

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
                        disabled={isLoading}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteState.close}
                        disabled={isLoading}
                    />
                </Dialog.Actions>
            </Dialog>
        </ScrollView>
    )
}
