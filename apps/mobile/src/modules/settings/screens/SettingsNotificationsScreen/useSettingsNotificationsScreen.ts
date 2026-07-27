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

import { useCallback } from 'react'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useAccountNotificationToggle } from '@hooks/useAccountNotificationToggle'
import { useSystemNotificationPermission } from '../../hooks/useSystemNotificationPermission'
import { trackEvent, SettingsEvent, AnalyticsMetadataKey } from '@analytics'

type UseSettingsNotificationsScreenResult = {
    isSystemNotificationEnabled: boolean
    isSystemNotificationLoading: boolean
    /** Whether this platform can deliver push at all (static platform fact). */
    isPushSupported: boolean
    accounts: WalletAccount[]
    /**
     * The raw list of addresses with notifications disabled. Exposed so the
     * consuming `<FlatList>` can pass it as `extraData` and re-render rows
     * when the toggle state changes — otherwise items stay cached and the
     * switch appears not to update.
     */
    disabledAccounts: string[]
    handleSystemNotificationToggle: () => void
    handleAccountNotificationToggle: (
        account: WalletAccount,
        enabled: boolean,
    ) => void
    isAccountNotificationEnabled: (address: string) => boolean
}

export const useSettingsNotificationsScreen =
    (): UseSettingsNotificationsScreenResult => {
        const { isEnabled, isLoading, openSettings } =
            useSystemNotificationPermission()
        const accounts = useAllAccounts()
        const { isAccountEnabled, disabledAccounts } =
            useNotificationPreferences()
        const { toggleAccountNotification } = useAccountNotificationToggle()

        const handleSystemNotificationToggle = useCallback(() => {
            openSettings()
        }, [openSettings])

        const handleAccountNotificationToggle = useCallback(
            (account: WalletAccount, enabled: boolean) => {
                trackEvent(SettingsEvent.ChangeNotificationFilter, {
                    [AnalyticsMetadataKey.AccountAddress]: account.address,
                    [AnalyticsMetadataKey.AllowNotifications]: enabled,
                })
                void toggleAccountNotification(account.address, enabled)
            },
            [toggleAccountNotification],
        )

        return {
            isSystemNotificationEnabled: isEnabled,
            isSystemNotificationLoading: isLoading,
            isPushSupported: getProvider().pushNotification.isSupported(),
            accounts,
            disabledAccounts,
            handleSystemNotificationToggle,
            handleAccountNotificationToggle,
            isAccountNotificationEnabled: isAccountEnabled,
        }
    }
