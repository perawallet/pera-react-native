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

import { type ComponentProps, useState } from 'react'
import { Dialog, useTheme } from '@rneui/themed'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    PWBadge,
    PWButton,
    PWIcon,
    PWImage,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { InfoButton } from '@components/InfoButton'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { PermissionItem } from '../PermissionItem'
import { useStyles } from './styles'

export type ConnectionNetwork = 'mainnet' | 'testnet'

export type ConnectionDetailsViewProps = {
    /** dApp favicon/peer-icon URL; falls back to `fallbackIconName` if absent or unloadable. */
    iconUri?: string
    fallbackIconName: ComponentProps<typeof PWIcon>['name']
    /** Connection name (WalletConnect peer name, or the Liquid Auth domain). */
    name: string
    /** Tappable URL/host shown under the name. */
    subtitle?: string
    onSubtitlePress?: () => void
    /** Optional dApp description (WalletConnect only). */
    description?: string
    /** Protocol badge, e.g. `WCV1` or `Liquid`. */
    versionBadge: string
    /** "This session is using …" line next to the badge. */
    versionText: string
    createdAt: Date
    accounts: WalletAccount[]
    /** Network(s) the session is bound to — rendered as a badge per account. */
    networks: ConnectionNetwork[]
    permissions: AlgorandPermission[]
    deleteModalState: {
        isOpen: boolean
        open: () => void
        close: () => void
    }
    onDelete: () => void
    isDeleting?: boolean
    /** testID prefix, e.g. `wallet_connect_details` / `liquid_auth_details`. */
    testIDPrefix: string
}

/**
 * Shared Connected-App details screen body for every connection protocol. The
 * protocol supplies its own icon, name/URL, badge, network(s) and permission
 * list; the scaffold (header, created-at, account list with network badges,
 * the Advanced Permissions panel, and the delete flow) is identical.
 */
export const ConnectionDetailsView = ({
    iconUri,
    fallbackIconName,
    name,
    subtitle,
    onSubtitlePress,
    description,
    versionBadge,
    versionText,
    createdAt,
    accounts,
    networks,
    permissions,
    deleteModalState,
    onDelete,
    isDeleting,
    testIDPrefix,
}: ConnectionDetailsViewProps) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const [iconFailed, setIconFailed] = useState(false)

    return (
        <PWScrollView
            contentContainerStyle={styles.container}
            testID={`${testIDPrefix}_screen`}
        >
            <PWView style={styles.iconContainer}>
                {iconUri && !iconFailed ? (
                    <PWImage
                        source={{ uri: iconUri }}
                        style={styles.icon}
                        onError={() => setIconFailed(true)}
                    />
                ) : (
                    <PWIcon
                        name={fallbackIconName}
                        size='xl'
                    />
                )}
            </PWView>
            <PWText variant='h2'>{name}</PWText>
            {!!subtitle && (
                <PWTouchableOpacity
                    onPress={onSubtitlePress}
                    testID={`${testIDPrefix}_url_link`}
                >
                    <PWText style={styles.link}>{subtitle}</PWText>
                </PWTouchableOpacity>
            )}
            {!!description && (
                <PWText style={styles.description}>{description}</PWText>
            )}
            <PWView style={styles.versionContainer}>
                <PWBadge
                    variant='secondary'
                    value={versionBadge}
                />
                <PWText style={styles.version}>{versionText}</PWText>
            </PWView>
            <PWView style={styles.connectionContainer}>
                <KeyValueRow
                    title={t('connections.settings.created_at', { date: '' })}
                >
                    <PWText style={styles.createdAt}>
                        {formatDatetime(createdAt, undefined, 'medium')}
                    </PWText>
                </KeyValueRow>
            </PWView>
            {accounts.length > 0 && (
                <PWView style={styles.accountContainer}>
                    <PWText>
                        {t('connections.settings.connected_accounts')}
                    </PWText>
                    {accounts.map(account => (
                        <PWView
                            style={styles.accountRow}
                            key={account.id}
                        >
                            <AccountDisplay
                                account={account}
                                showChevron={false}
                                style={styles.accountDisplay}
                            />
                            <PWView style={styles.networkContainer}>
                                {networks.includes('mainnet') && (
                                    <PWText style={styles.mainnetText}>
                                        {t(
                                            'walletconnect.request.networks_mainnet',
                                        )}
                                    </PWText>
                                )}
                                {networks.includes('testnet') && (
                                    <PWText style={styles.testnetText}>
                                        {t(
                                            'walletconnect.request.networks_testnet',
                                        )}
                                    </PWText>
                                )}
                            </PWView>
                        </PWView>
                    ))}
                </PWView>
            )}
            <TitledExpandablePanel
                title={
                    <PWView style={styles.permissionsTitle}>
                        <PWText>{t('connections.settings.permissions')}</PWText>
                        <InfoButton
                            size='sm'
                            title={t(
                                'connections.settings.permissions_info_title',
                            )}
                        >
                            <PWText>
                                {t(
                                    'connections.settings.permissions_info_body',
                                )}
                            </PWText>
                        </InfoButton>
                    </PWView>
                }
            >
                <PWView style={styles.permissionsContainer}>
                    {permissions.map(permission => (
                        <PermissionItem
                            key={permission}
                            permission={permission}
                        />
                    ))}
                </PWView>
            </TitledExpandablePanel>
            <PWView style={styles.deleteContainer}>
                <PWButton
                    variant='secondary'
                    title={t('connections.settings.delete_title')}
                    onPress={deleteModalState.open}
                    testID={`${testIDPrefix}_delete_button`}
                />
            </PWView>
            <Dialog
                isVisible={deleteModalState.isOpen}
                onBackdropPress={deleteModalState.close}
            >
                <Dialog.Title title={t('connections.settings.delete_title')} />
                <PWText>{t('connections.settings.delete_body')}</PWText>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.alertNegative }}
                        onPress={onDelete}
                        disabled={isDeleting}
                        testID={`${testIDPrefix}_confirm_delete_button`}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={deleteModalState.close}
                        disabled={isDeleting}
                        testID={`${testIDPrefix}_cancel_button`}
                    />
                </Dialog.Actions>
            </Dialog>
        </PWScrollView>
    )
}
