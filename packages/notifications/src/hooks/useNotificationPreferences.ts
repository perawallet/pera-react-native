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
import { useNotificationsStore } from '../store'

type UseNotificationPreferencesResult = {
    disabledAccounts: string[]
    setAccountEnabled: (address: string, enabled: boolean) => void
    isAccountEnabled: (address: string) => boolean
}

export const useNotificationPreferences =
    (): UseNotificationPreferencesResult => {
        const disabledAccounts = useNotificationsStore(
            state => state.notificationDisabledAccounts,
        )
        const setAccountNotificationEnabled = useNotificationsStore(
            state => state.setAccountNotificationEnabled,
        )

        const setAccountEnabled = useCallback(
            (address: string, enabled: boolean) => {
                setAccountNotificationEnabled(address, enabled)
            },
            [setAccountNotificationEnabled],
        )

        const isAccountEnabled = useCallback(
            (address: string) => {
                return !disabledAccounts.includes(address)
            },
            [disabledAccounts],
        )

        return {
            disabledAccounts,
            setAccountEnabled,
            isAccountEnabled,
        }
    }
