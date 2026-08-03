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

import { useState, useEffect, useCallback } from 'react'
import { openExternalTab } from '@perawallet/wallet-extension-platform-chrome'

type UseSystemNotificationPermissionResult = {
    isEnabled: boolean
    isLoading: boolean
    openSettings: () => void
    refetch: () => Promise<void>
}

// Chrome's own page for per-site/extension notification permission. Reached
// via chrome.tabs.create because react-native-web implements no
// Linking.openSettings — calling the native hook's version here would throw.
const CHROME_NOTIFICATION_SETTINGS_URL =
    'chrome://settings/content/notifications'

/**
 * Web twin. The native hook reads notifee, whose web shim is a hardcoded
 * `DENIED` stub — it was written while push was capability-gated off on web,
 * so consuming it here would render the system-notifications switch
 * permanently off even though declaring the `notifications` manifest
 * permission auto-grants `Notification.permission` on extension pages.
 * Report the browser's real state instead.
 */
export const useSystemNotificationPermission =
    (): UseSystemNotificationPermissionResult => {
        const [isEnabled, setIsEnabled] = useState(false)
        const [isLoading, setIsLoading] = useState(true)

        const checkPermission = useCallback(async () => {
            setIsEnabled(
                typeof Notification !== 'undefined' &&
                    Notification.permission === 'granted',
            )
            setIsLoading(false)
        }, [])

        useEffect(() => {
            void checkPermission()
        }, [checkPermission])

        // Permission is revoked outside the extension (chrome://settings or the
        // OS), so the surface becoming visible again is the only signal that it
        // may have changed — the web counterpart of native's AppState 'active'.
        useEffect(() => {
            const handleVisibilityChange = () => {
                void checkPermission()
            }

            document.addEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )

            return () => {
                document.removeEventListener(
                    'visibilitychange',
                    handleVisibilityChange,
                )
            }
        }, [checkPermission])

        const openSettings = useCallback(() => {
            openExternalTab(CHROME_NOTIFICATION_SETTINGS_URL)
        }, [])

        return {
            isEnabled,
            isLoading,
            openSettings,
            refetch: checkPermission,
        }
    }
