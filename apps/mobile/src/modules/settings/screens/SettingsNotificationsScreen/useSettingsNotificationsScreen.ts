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

import { useCallback, useMemo } from 'react'
import {
    chainAccountOf,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useNotificationPreferences,
    useNotificationsChainResolver,
} from '@perawallet/wallet-core-messages'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useAccountNotificationToggle } from '@hooks/useAccountNotificationToggle'
import { useSystemNotificationPermission } from '../../hooks/useSystemNotificationPermission'
import { trackEvent, SettingsEvent, AnalyticsMetadataKey } from '@analytics'

type UseSettingsNotificationsScreenResult = {
    isSystemNotificationEnabled: boolean
    isSystemNotificationLoading: boolean
    /** Permission is granted but the browser's push service refused a token. */
    isPushServiceUnavailable: boolean
    /** Whether this platform can deliver push at all (static platform fact). */
    isPushSupported: boolean
    /** Only accounts device registration tells the backend about. */
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
    /**
     * Whether that account's toggle is still awaiting the backend. Rows use it
     * to disable the switch, so a second tap is visibly blocked rather than
     * silently dropped by the hook's per-address guard.
     */
    isAccountNotificationPending: (address: string) => boolean
}

export const useSettingsNotificationsScreen =
    (): UseSettingsNotificationsScreenResult => {
        const { isEnabled, isLoading, isPushServiceUnavailable, openSettings } =
            useSystemNotificationPermission()
        const allAccounts = useAllAccounts()
        const notificationsChainOf = useNotificationsChainResolver()
        const accounts = useMemo(
            () =>
                allAccounts.filter(
                    account => notificationsChainOf(account) !== undefined,
                ),
            [allAccounts, notificationsChainOf],
        )
        const { isAccountEnabled, disabledAccounts } =
            useNotificationPreferences()
        const { toggleAccountNotification, isTogglePending } =
            useAccountNotificationToggle()

        const handleSystemNotificationToggle = useCallback(() => {
            openSettings()
        }, [openSettings])

        const handleAccountNotificationToggle = useCallback(
            (account: WalletAccount, enabled: boolean) => {
                const chainId = notificationsChainOf(account)
                if (chainId === undefined) return
                const address = chainAccountOf(account, chainId)?.address
                if (address === undefined) return
                trackEvent(SettingsEvent.ChangeNotificationFilter, {
                    [AnalyticsMetadataKey.AccountAddress]: address,
                    [AnalyticsMetadataKey.AllowNotifications]: enabled,
                    [AnalyticsMetadataKey.ChainId]: chainId,
                })
                void toggleAccountNotification(address, enabled)
            },
            [toggleAccountNotification, notificationsChainOf],
        )

        return {
            isSystemNotificationEnabled: isEnabled,
            isSystemNotificationLoading: isLoading,
            isPushServiceUnavailable,
            isPushSupported: getProvider().pushNotification.isSupported(),
            accounts,
            disabledAccounts,
            handleSystemNotificationToggle,
            handleAccountNotificationToggle,
            isAccountNotificationEnabled: isAccountEnabled,
            isAccountNotificationPending: isTogglePending,
        }
    }
