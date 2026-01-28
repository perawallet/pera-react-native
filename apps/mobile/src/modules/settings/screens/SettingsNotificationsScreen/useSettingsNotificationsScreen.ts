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

import { useCallback } from 'react'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useNotificationPreferences,
    useAccountNotificationEnabledMutation,
} from '@perawallet/wallet-core-notifications'
import { useSystemNotificationPermission } from '../../hooks/useSystemNotificationPermission'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

type UseSettingsNotificationsScreenResult = {
    isSystemNotificationEnabled: boolean
    isSystemNotificationLoading: boolean
    accounts: WalletAccount[]
    handleSystemNotificationToggle: () => void
    handleAccountNotificationToggle: (
        account: WalletAccount,
        enabled: boolean,
    ) => void
    isAccountNotificationEnabled: (address: string) => boolean
}

export const useSettingsNotificationsScreen =
    (): UseSettingsNotificationsScreenResult => {
        const { showToast } = useToast()
        const { isEnabled, isLoading, openSettings } =
            useSystemNotificationPermission()
        const accounts = useAllAccounts()
        const { setAccountEnabled, isAccountEnabled } =
            useNotificationPreferences()
        const { mutateAsync } = useAccountNotificationEnabledMutation()
        const { t } = useLanguage()

        const handleSystemNotificationToggle = useCallback(() => {
            openSettings()
        }, [openSettings])

        const handleAccountNotificationToggle = useCallback(
            (account: WalletAccount, enabled: boolean) => {
                if (!account.id) {
                    return
                }
                setAccountEnabled(account.address, enabled)
                mutateAsync({
                    accountID: account.address,
                    status: enabled,
                }).catch(() => {
                    setAccountEnabled(account.address, !enabled)
                    showToast({
                        title: t('common.error.title'),
                        body: t('common.error.body'),
                        type: 'error',
                    })
                })
            },
            [setAccountEnabled, mutateAsync],
        )

        return {
            isSystemNotificationEnabled: isEnabled,
            isSystemNotificationLoading: isLoading,
            accounts,
            handleSystemNotificationToggle,
            handleAccountNotificationToggle,
            isAccountNotificationEnabled: isAccountEnabled,
        }
    }
