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
    PWScrollView,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'
import { Dialog, Image, Text, useTheme } from '@rneui/themed'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { WalletConnectSettingsStackParamsList } from '@modules/settings/routes'
import { KeyValueRow } from '@components/KeyValueRow'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'
import { InfoButton } from '@components/InfoButton'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSettingsWalletConnectDetailsScreen } from './useSettingsWalletConnectDetailsScreen'

export type SettingsWalletConnectDetailsScreenProps = NativeStackScreenProps<
    WalletConnectSettingsStackParamsList,
    'WalletConnectSettingsDetails'
>

const ConnectedNetworks = ({ chainId }: { chainId: number }) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    return (
        <PWView style={styles.networkContainer}>
            {(chainId === 4160 || chainId === 416001) && (
                <Text style={styles.mainnetText}>
                    {t('walletconnect.request.networks_mainnet')}
                </Text>
            )}
            {(chainId === 4160 || chainId === 416002) && (
                <Text style={styles.testnetText}>
                    {t('walletconnect.request.networks_testnet')}
                </Text>
            )}
        </PWView>
    )
}

export const SettingsWalletConnectDetailsScreen = ({
    route,
}: SettingsWalletConnectDetailsScreenProps) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { session } = route.params

    const {
        peerMeta,
        preferredIcon,
        connectedAccounts,
        isLoading,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    } = useSettingsWalletConnectDetailsScreen(session)

    return (
        <PWScrollView contentContainerStyle={styles.container}>
            {!!preferredIcon && (
                <Image
                    source={{ uri: preferredIcon }}
                    style={styles.icon}
                />
            )}
            {!preferredIcon && (
                <PWIcon
                    name='wallet-connect'
                    size='xl'
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
                <KeyValueRow
                    title={t('walletconnect.settings.created_at', { date: '' })}
                >
                    <Text style={styles.createdAt}>
                        {formatDatetime(
                            session?.createdAt ?? new Date(),
                            undefined,
                            'medium',
                        )}
                    </Text>
                </KeyValueRow>
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
                    {session.session?.permissions?.map(permission => (
                        <PermissionItem
                            key={permission}
                            permission={permission as AlgorandPermission}
                        />
                    ))}
                </PWView>
            </TitledExpandablePanel>

            <PWView style={styles.deleteContainer}>
                <PWButton
                    variant='secondary'
                    title={t('walletconnect.settings.delete_title')}
                    onPress={deleteModalState.open}
                />
            </PWView>
            <Dialog
                isVisible={deleteModalState.isOpen}
                onBackdropPress={deleteModalState.close}
            >
                <Dialog.Title
                    title={t('walletconnect.settings.delete_title')}
                />
                <Text>{t('walletconnect.settings.delete_body')}</Text>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.alertNegative }}
                        onPress={handleDelete}
                        disabled={isLoading}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteModalState.close}
                        disabled={isLoading}
                    />
                </Dialog.Actions>
            </Dialog>
        </PWScrollView>
    )
}
