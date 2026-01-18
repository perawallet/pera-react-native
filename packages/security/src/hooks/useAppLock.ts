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
import { useSecurityStore } from '../store'

const SESSION_TIMEOUT_MS = 5 * 60 * 1000

type UseAppLockResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    lastBackgroundTime: number | null
    shouldRequireAuth: boolean
    recordBackground: () => void
    recordForeground: () => boolean
    checkSessionExpired: () => boolean
}

export const useAppLock = (): UseAppLockResult => {
    const isPinEnabled = useSecurityStore(state => state.isPinEnabled)
    const isBiometricEnabled = useSecurityStore(
        state => state.isBiometricEnabled,
    )
    const lastBackgroundTime = useSecurityStore(
        state => state.lastBackgroundTime,
    )
    const setLastBackgroundTime = useSecurityStore(
        state => state.setLastBackgroundTime,
    )

    const checkSessionExpired = useCallback((): boolean => {
        if (!isPinEnabled) return false
        if (lastBackgroundTime === null) return true

        const elapsed = Date.now() - lastBackgroundTime
        return elapsed > SESSION_TIMEOUT_MS
    }, [isPinEnabled, lastBackgroundTime])

    const shouldRequireAuth = isPinEnabled && checkSessionExpired()

    const recordBackground = useCallback(() => {
        setLastBackgroundTime(Date.now())
    }, [setLastBackgroundTime])

    const recordForeground = useCallback((): boolean => {
        const expired = checkSessionExpired()
        return expired
    }, [checkSessionExpired])

    return {
        isPinEnabled,
        isBiometricEnabled,
        lastBackgroundTime,
        shouldRequireAuth,
        recordBackground,
        recordForeground,
        checkSessionExpired,
    }
}
