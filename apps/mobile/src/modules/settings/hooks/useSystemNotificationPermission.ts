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

import { useState, useEffect, useCallback } from 'react'
import { Linking, AppState, AppStateStatus } from 'react-native'
import notifee, { AuthorizationStatus } from '@notifee/react-native'

type UseSystemNotificationPermissionResult = {
    isEnabled: boolean
    isLoading: boolean
    openSettings: () => void
    refetch: () => Promise<void>
}

export const useSystemNotificationPermission =
    (): UseSystemNotificationPermissionResult => {
        const [isEnabled, setIsEnabled] = useState(false)
        const [isLoading, setIsLoading] = useState(true)

        const checkPermission = useCallback(async () => {
            try {
                const settings = await notifee.getNotificationSettings()
                const enabled =
                    settings.authorizationStatus ===
                    AuthorizationStatus.AUTHORIZED
                setIsEnabled(enabled)
            } catch {
                setIsEnabled(false)
            } finally {
                setIsLoading(false)
            }
        }, [])

        useEffect(() => {
            checkPermission()
        }, [checkPermission])

        useEffect(() => {
            const handleAppStateChange = (nextState: AppStateStatus) => {
                if (nextState === 'active') {
                    checkPermission()
                }
            }

            const subscription = AppState.addEventListener(
                'change',
                handleAppStateChange,
            )

            return () => {
                subscription.remove()
            }
        }, [checkPermission])

        const openSettings = useCallback(() => {
            Linking.openSettings()
        }, [])

        return {
            isEnabled,
            isLoading,
            openSettings,
            refetch: checkPermission,
        }
    }
