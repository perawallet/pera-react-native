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
    PWFlatList,
    PWSwitch,
    PWText,
    PWTextProps,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsNotificationsScreen } from './useSettingsNotificationsScreen'
import { useStyles } from './styles'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useMemo } from 'react'
import { AccountIconProps } from '@modules/accounts/components/AccountIcon'

const iconProps = {
    size: 'lg',
} as AccountIconProps

const AccountNotificationItem = ({
    account,
    isEnabled,
    onToggle,
}: {
    account: WalletAccount
    isEnabled: boolean
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
            <AccountDisplay
                account={account}
                showChevron={false}
                iconProps={iconProps}
                textProps={textProps}
            />
            <PWSwitch
                value={isEnabled}
                onValueChange={onToggle}
            />
        </PWView>
    )
}

export const SettingsNotificationsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        isSystemNotificationEnabled,
        isSystemNotificationLoading,
        accounts,
        handleSystemNotificationToggle,
        handleAccountNotificationToggle,
        isAccountNotificationEnabled,
    } = useSettingsNotificationsScreen()

    return (
        <PWFlatList
            data={accounts}
            keyExtractor={item => item.address}
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
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
                    onToggle={enabled =>
                        handleAccountNotificationToggle(item, enabled)
                    }
                />
            )}
            ListHeaderComponent={
                <PWView style={styles.header}>
                    <PWView style={styles.headerRow}>
                        <PWText variant='body'>
                            {t('settings.notifications.push_notifications')}
                        </PWText>

                        <PWSwitch
                            value={isSystemNotificationEnabled}
                            onValueChange={handleSystemNotificationToggle}
                            disabled={isSystemNotificationLoading}
                        />
                    </PWView>

                    <PWView style={styles.headerRow}>
                        <PWText
                            variant='caption'
                            style={styles.grayText}
                        >
                            {t('settings.notifications.account_notifications')}
                        </PWText>
                    </PWView>
                </PWView>
            }
        />
    )
}
