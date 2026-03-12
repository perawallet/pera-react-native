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
import { logger } from '@perawallet/wallet-core-shared'
import {
    AppStateValue,
    isBackgroundTransition,
    isForegroundTransition,
} from '@utils/app-state'

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

    const recordBackground = useCallback(() => {
        setAutoLockStartedAt(Date.now())
    }, [setAutoLockStartedAt])

    const recordForeground = useCallback(
        async (transitionContext?: {
            previousState: AppStateValue
            nextState: AppStateValue
        }): Promise<boolean> => {
            setIsChecking(true)
            try {
                const expired = await checkAutoLock()
                setIsLocked(expired)
                return expired
            } catch (error) {
                logger.error('Auto-lock foreground check failed', {
                    source: 'AutoLockGuard.useAutoLockListener',
                    phase: 'foreground',
                    previousState: transitionContext?.previousState ?? null,
                    nextState: transitionContext?.nextState ?? null,
                    lockEnabled: isLocked,
                    error,
                })
                return isLocked
            } finally {
                setIsChecking(false)
            }
        },
        [checkAutoLock, isLocked],
    )

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
    }, [deleteAllData, setAutoLockStartedAt])

    useEffect(() => {
        if (!isInitialized) {
            let isMounted = true
            setIsChecking(true)

            void checkPinEnabled()
                .then(enabled => {
                    if (!isMounted) {
                        return
                    }
                    setIsLocked(enabled)
                })
                .catch(error => {
                    if (!isMounted) {
                        return
                    }
                    logger.error('Auto-lock initialization check failed', {
                        source: 'AutoLockGuard.useAutoLockListener',
                        phase: 'initialization',
                        lockEnabled: null,
                        error,
                    })
                })
                .finally(() => {
                    if (!isMounted) {
                        return
                    }
                    setIsInitialized(true)
                    setIsChecking(false)
                })

            return () => {
                isMounted = false
            }
        }
    }, [checkPinEnabled, isInitialized])

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const previousState = appState.current

            if (isBackgroundTransition(previousState, nextAppState)) {
                recordBackground()
            } else if (isForegroundTransition(previousState, nextAppState)) {
                void recordForeground({
                    previousState,
                    nextState: nextAppState,
                })
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
