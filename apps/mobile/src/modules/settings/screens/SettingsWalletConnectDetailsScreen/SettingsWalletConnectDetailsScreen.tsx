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

import { Dialog, Image, useTheme } from '@rneui/themed'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'

import {
    PWBadge,
    PWButton,
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'
import { useSettingsWalletConnectDetailsScreen } from './useSettingsWalletConnectDetailsScreen'
import { useStyles } from './styles'

import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { WalletConnectSettingsStackParamsList } from '@modules/settings/routes'

export type SettingsWalletConnectDetailsScreenProps = NativeStackScreenProps<
    WalletConnectSettingsStackParamsList,
    'WalletConnectSettingsDetails'
>

const ConnectedNetworks = ({ chainId }: { chainId: number }) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.networkContainer}>
            {(chainId === 4160 || chainId === 416_001) && (
                <PWText style={styles.mainnetText}>
                    {t('walletconnect.request.networks_mainnet')}
                </PWText>
            )}
            {(chainId === 4160 || chainId === 416_002) && (
                <PWText style={styles.testnetText}>
                    {t('walletconnect.request.networks_testnet')}
                </PWText>
            )}
        </PWView>
    )
}

export const SettingsWalletConnectDetailsScreen = ({
    route,
}: SettingsWalletConnectDetailsScreenProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
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
        <PWScreen testID='wallet_connect_details_screen'>
            <PWView style={styles.container}>
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
                <PWText variant='h4'>
                    {peerMeta?.name ?? t('walletconnect.settings.unknown_peer')}
                </PWText>
                {peerMeta?.url && (
                    <PWTouchableOpacity
                        onPress={handleOpenLink}
                        testID='wallet_connect_details_url_link'
                    >
                        <PWText style={styles.link}>{peerMeta?.url}</PWText>
                    </PWTouchableOpacity>
                )}
                {peerMeta?.description && (
                    <PWText style={styles.description}>
                        {peerMeta?.description}
                    </PWText>
                )}
                <PWView style={styles.versionContainer}>
                    <PWBadge
                        variant='secondary'
                        value={`WCV${session?.version}`}
                    />
                    <PWText style={styles.version}>
                        {t('walletconnect.settings.version', {
                            version: session?.version,
                        })}
                    </PWText>
                </PWView>
                <PWView style={styles.connectionContainer}>
                    <KeyValueRow
                        title={t('walletconnect.settings.created_at', {
                            date: '',
                        })}
                    >
                        <PWText style={styles.createdAt}>
                            {formatDatetime(
                                session?.createdAt ?? new Date(),
                                undefined,
                                'medium',
                            )}
                        </PWText>
                    </KeyValueRow>
                </PWView>
                {!!connectedAccounts?.length && (
                    <PWView style={styles.accountContainer}>
                        <PWText>
                            {t('walletconnect.settings.connected_accounts')}
                        </PWText>
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
                            <PWText>
                                {t('walletconnect.settings.permissions')}
                            </PWText>
                            <InfoButton
                                size='sm'
                                title={t(
                                    'walletconnect.settings.permissions_info_title',
                                )}
                            >
                                <PWText>
                                    {t(
                                        'walletconnect.settings.permissions_info_body',
                                    )}
                                </PWText>
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
                        testID='wallet_connect_details_delete_button'
                    />
                </PWView>
                <Dialog
                    isVisible={deleteModalState.isOpen}
                    onBackdropPress={deleteModalState.close}
                >
                    <Dialog.Title
                        title={t('walletconnect.settings.delete_title')}
                    />
                    <PWText>{t('walletconnect.settings.delete_body')}</PWText>
                    <Dialog.Actions>
                        <Dialog.Button
                            title={t('common.delete.label')}
                            titleStyle={{
                                color: theme.colors.alertNegative,
                            }}
                            onPress={handleDelete}
                            disabled={isLoading}
                            testID='wallet_connect_details_confirm_delete_button'
                        />
                        <Dialog.Button
                            title={t('common.cancel.label')}
                            onPress={deleteModalState.close}
                            disabled={isLoading}
                            testID='wallet_connect_details_cancel_button'
                        />
                    </Dialog.Actions>
                </Dialog>
            </PWView>
        </PWScreen>
    )
}
