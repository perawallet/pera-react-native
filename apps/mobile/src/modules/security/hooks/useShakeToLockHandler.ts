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

import { useCallback, useEffect, useState } from 'react'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { usePinCode, useSecurityStore } from '@perawallet/wallet-core-security'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useShakeDetection } from '@modules/security/hooks/useShakeDetection'
import { AppState, type AppStateStatus } from 'react-native'

export const useShakeToLockHandler = (): void => {
    const remoteConfig = useRemoteConfig()
    const motionLockFlag = remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_motion_lock,
        false,
    )

    const { getPreference } = usePreferences()
    const shakeToLockEnabled = !!getPreference(
        UserPreferences.shakeToLockEnabled,
    )

    const { checkPinEnabled } = usePinCode()
    const [isPinEnabled, setIsPinEnabled] = useState(false)
    const [isForeground, setIsForeground] = useState(
        AppState.currentState === 'active',
    )

    useEffect(() => {
        const handle = (next: AppStateStatus) => {
            setIsForeground(next === 'active')
        }
        const subscription = AppState.addEventListener('change', handle)
        return () => subscription.remove()
    }, [])

    useEffect(() => {
        let cancelled = false
        checkPinEnabled()
            .then(value => {
                if (!cancelled) setIsPinEnabled(value)
            })
            .catch(() => {
                if (!cancelled) setIsPinEnabled(false)
            })
        return () => {
            cancelled = true
        }
    }, [checkPinEnabled])

    const requestLock = useSecurityStore(state => state.requestLock)
    const handleTrigger = useCallback(() => {
        requestLock()
    }, [requestLock])

    useShakeDetection({
        enabled:
            isForeground &&
            motionLockFlag &&
            shakeToLockEnabled &&
            isPinEnabled,
        onTrigger: handleTrigger,
    })
}
