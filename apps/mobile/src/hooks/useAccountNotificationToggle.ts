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
    useNotificationPreferences,
    useAccountNotificationEnabledMutation,
} from '@perawallet/wallet-core-messages'
import { useErrorToast } from './useErrorToast'
import { useLanguage } from './useLanguage'

export type UseAccountNotificationToggleResult = {
    /**
     * Flips an account's notification preference.
     *
     * Writes the persisted store optimistically so the switch moves at once,
     * then PATCHes the backend. On rejection the local write is reverted and a
     * cause-appropriate localized error is shown — offline failures get the
     * `errors.network.no_connection.*` copy via {@link useErrorToast}.
     *
     * Mutations run under `networkMode: 'always'` (PERA-4573), so offline
     * requests reject immediately rather than pausing. There is deliberately
     * no queue or replay: the local store must never hold a value the backend
     * was not told about, because it is persisted and would survive a restart.
     *
     * @returns `true` only when the backend accepted the change.
     */
    toggleAccountNotification: (
        address: string,
        enabled: boolean,
    ) => Promise<boolean>
}

export const useAccountNotificationToggle =
    (): UseAccountNotificationToggleResult => {
        const { setAccountEnabled } = useNotificationPreferences()
        const { mutateAsync } = useAccountNotificationEnabledMutation()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        const toggleAccountNotification = useCallback(
            async (address: string, enabled: boolean): Promise<boolean> => {
                setAccountEnabled(address, enabled)

                try {
                    await mutateAsync({ accountID: address, status: enabled })
                    return true
                } catch (error) {
                    setAccountEnabled(address, !enabled)
                    showError(error, t('common.error.title'))
                    return false
                }
            },
            [setAccountEnabled, mutateAsync, showError, t],
        )

        return { toggleAccountNotification }
    }
