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

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'
import { AppState, AppStateStatus } from 'react-native'
import { getAppStatePlatform, getAppStateTransition } from '@utils/app-state'

type UseAutoLockListenerResult = {
    isLocked: boolean
    isChecking: boolean
    unlock: () => void
    handleResetData: () => void
}

export const useAutoLockListener = (): UseAutoLockListenerResult => {
    const { checkAutoLock, setAutoLockStartedAt, checkPinEnabled } =
        usePinCode()
    const { deleteAllData } = useDeleteAllData()

    const [isLocked, setIsLocked] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current
    const isForegroundCheckInFlight = useRef(false)

    const recordBackground = useCallback(() => {
        setAutoLockStartedAt(Date.now())
    }, [setAutoLockStartedAt])

    const recordForeground = useCallback(async (): Promise<void> => {
        if (isForegroundCheckInFlight.current) {
            return
        }

        isForegroundCheckInFlight.current = true
        setIsChecking(true)
        try {
            const expired = await checkAutoLock()
            setIsLocked(expired)
        } catch {
            // Keep current lock state on errors.
        } finally {
            setIsChecking(false)
            isForegroundCheckInFlight.current = false
        }
    }, [checkAutoLock])

    const unlock = useCallback(() => {
        setIsChecking(false)
        setIsLocked(false)
        setAutoLockStartedAt(null)
    }, [setAutoLockStartedAt])

    const handleResetData = useCallback(async () => {
        await deleteAllData()
        setIsChecking(false)
        setIsLocked(false)
        setAutoLockStartedAt(null)
    }, [deleteAllData])

    useEffect(() => {
        let isCancelled = false

        const initialize = async () => {
            try {
                const enabled = await checkPinEnabled()
                if (!isCancelled) {
                    setIsLocked(enabled)
                }
            } catch {
                // Keep current lock state on errors.
            } finally {
                if (!isCancelled) {
                    setIsInitialized(true)
                }
            }
        }

        void initialize()

        return () => {
            isCancelled = true
        }
    }, [checkPinEnabled])

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const { didLeaveForeground, didEnterForeground } =
                getAppStateTransition(
                    appState.current,
                    nextAppState,
                    appStatePlatform,
                )

            if (didLeaveForeground) {
                recordBackground()
            } else if (didEnterForeground) {
                void recordForeground()
            }

            appState.current = nextAppState
        }

        const subscription = AppState.addEventListener(
            'change',
            handleAppStateChange,
        )

        return () => {
            subscription.remove()
        }
    }, [appStatePlatform, recordBackground, recordForeground])

    return {
        isLocked,
        isChecking: isChecking || !isInitialized,
        unlock,
        handleResetData,
    }
}
