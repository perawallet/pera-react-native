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
    PWFlatList,
    PWSwitch,
    PWText,
    type PWTextProps,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/useSettingsNotificationsScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { ListItemDivider } from '@components/ListItemDivider'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useMemo } from 'react'
import type { AccountIconProps } from '@modules/accounts/components/AccountIcon'
import { useStyles } from './styles'
import type { StyleProp, ViewStyle } from 'react-native'

export type NotificationSettingsListProps = {
    style?: StyleProp<ViewStyle>
    contentContainerStyle?: StyleProp<ViewStyle>
    inBottomSheet?: boolean
    testID?: string
}

const iconProps = {
    size: 'lg',
} as AccountIconProps

const AccountNotificationItem = ({
    account,
    isEnabled,
    isPending,
    onToggle,
}: {
    account: WalletAccount
    isEnabled: boolean
    isPending: boolean
    onToggle: (enabled: boolean) => void
}) => {
    const styles = useStyles()

    const textProps = useMemo<PWTextProps>(
        () => ({
            style: styles.mainText,
            variant: 'h4',
        }),
        [styles],
    )

    return (
        <PWView style={styles.accountItem}>
            <PWView style={styles.accountInfo}>
                <AccountDisplay
                    account={account}
                    showChevron={false}
                    iconProps={iconProps}
                    textProps={textProps}
                    style={styles.accountDisplay}
                />
            </PWView>
            <PWView style={styles.switchContainer}>
                <PWSwitch
                    value={isEnabled}
                    onValueChange={onToggle}
                    disabled={isPending}
                />
            </PWView>
        </PWView>
    )
}

export const NotificationSettingsList = ({
    style,
    contentContainerStyle,
    inBottomSheet,
    testID,
}: NotificationSettingsListProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        isSystemNotificationEnabled,
        isSystemNotificationLoading,
        isPushSupported,
        accounts,
        disabledAccounts,
        handleSystemNotificationToggle,
        handleAccountNotificationToggle,
        isAccountNotificationEnabled,
        isAccountNotificationPending,
    } = useSettingsNotificationsScreen()

    // Rows must also re-render while a toggle is in flight, otherwise the
    // switch would stay enabled until the request settles.
    const extraData = useMemo(
        () => [disabledAccounts, isAccountNotificationPending],
        [disabledAccounts, isAccountNotificationPending],
    )

    return (
        <PWFlatList
            data={accounts}
            extraData={extraData}
            keyExtractor={item => item.address}
            style={style}
            inBottomSheet={inBottomSheet}
            contentContainerStyle={contentContainerStyle}
            testID={testID}
            ItemSeparatorComponent={ListItemDivider}
            ListEmptyComponent={
                <EmptyView
                    title={t('settings.notifications.no_accounts')}
                    body={t('settings.notifications.no_accounts_body')}
                />
            }
            renderItem={({ item }) => (
                <AccountNotificationItem
                    account={item}
                    isEnabled={isAccountNotificationEnabled(item.address)}
                    isPending={isAccountNotificationPending(item.address)}
                    onToggle={enabled =>
                        handleAccountNotificationToggle(item, enabled)
                    }
                />
            )}
            ListHeaderComponent={
                <PWView style={styles.header}>
                    {isPushSupported && (
                        <PWView style={styles.headerRow}>
                            <PWView style={styles.headerLabelContainer}>
                                <PWText
                                    variant='body'
                                    truncate
                                >
                                    {t(
                                        'settings.notifications.push_notifications',
                                    )}
                                </PWText>
                            </PWView>
                            <PWView style={styles.switchContainer}>
                                <PWSwitch
                                    value={isSystemNotificationEnabled}
                                    onValueChange={
                                        handleSystemNotificationToggle
                                    }
                                    disabled={isSystemNotificationLoading}
                                />
                            </PWView>
                        </PWView>
                    )}
                    <PWView style={styles.headerRow}>
                        <PWView style={styles.headerLabelContainer}>
                            <PWText
                                variant='caption'
                                style={styles.grayText}
                                truncate
                            >
                                {t(
                                    'settings.notifications.account_notifications',
                                )}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            }
        />
    )
}
