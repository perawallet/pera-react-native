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

type UseAutoLockListenerResult = {
    isLocked: boolean
    isChecking: boolean
    unlock: () => void
    handleResetData: () => void
}

export const useAutoLockListener = (): UseAutoLockListenerResult => {
    const { checkAutoLock, setAutoLockStartedAt, checkPinEnabled } =
        usePinCode()
    const deleteAllData = useDeleteAllData()

    const [isLocked, setIsLocked] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const appState = useRef(AppState.currentState)

    const recordBackground = useCallback(() => {
        setIsChecking(true)
        setAutoLockStartedAt(Date.now())
    }, [setAutoLockStartedAt])

    const recordForeground = useCallback(async (): Promise<boolean> => {
        setIsChecking(true)
        const expired = await checkAutoLock()
        setIsLocked(expired)
        setIsChecking(false)
        return expired
    }, [checkAutoLock, setAutoLockStartedAt])

    const unlock = useCallback(() => {
        setIsChecking(false)
        setIsLocked(false)
        setAutoLockStartedAt(null)
    }, [])

    const handleResetData = useCallback(async () => {
        await deleteAllData()
        setIsChecking(false)
        setIsLocked(false)
        setAutoLockStartedAt(null)
    }, [deleteAllData])

    useEffect(() => {
        if (!isInitialized) {
            checkPinEnabled().then(enabled => {
                setIsLocked(enabled)
                setIsInitialized(true)
            })
        }
    }, [checkPinEnabled])

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appState.current === 'active' &&
                nextAppState.match(/inactive|background/)
            ) {
                recordBackground()
            } else if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                recordForeground()
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
    }, [recordBackground, recordForeground])

    return {
        isLocked,
        isChecking: isChecking || !isInitialized,
        unlock,
        handleResetData,
    }
}
