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

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePinCode, useSecurityStore } from '@perawallet/wallet-core-security'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import {
    clearAccountsStore,
    useDeleteAllData,
} from '@modules/settings/hooks/useDeleteAllData'
import { AppState, type AppStateStatus } from 'react-native'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    type AppStateValue,
    getAppStatePlatform,
    getAppStateTransition,
} from '@utils/app-state'
import { useIsMounted } from '@hooks/useIsMounted'

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
    const isMounted = useIsMounted()
    const lockRequestVersion = useSecurityStore(
        state => state.lockRequestVersion,
    )
    const setAppLockActive = useSecurityStore(state => state.setAppLockActive)
    const setPresentationHeld = useBottomSheetStore(
        state => state.setPresentationHeld,
    )

    const [isLocked, setIsLocked] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isChecking, setIsChecking] = useState(false)

    // Mirror the guard overlay outward: the bottom-sheet hold is what keeps
    // ALL sheets from painting into the covered layer and "popping in" the
    // moment the PIN is accepted (PERA-4743) — BottomSheetManager reads it
    // directly. The security-store flag stays mirrored for any non-sheet
    // consumer.
    const isGuardActive = isLocked || isChecking || !isInitialized
    useEffect(() => {
        setAppLockActive(isGuardActive)
        setPresentationHeld(isGuardActive)
    }, [setAppLockActive, setPresentationHeld, isGuardActive])
    // Never leave the flags stuck on if the guard unmounts (route-tree swap) —
    // a stale `true` would hold sheets forever.
    useEffect(
        () => () => {
            setAppLockActive(false)
            setPresentationHeld(false)
        },
        [setAppLockActive, setPresentationHeld],
    )
    const appState = useRef<AppStateValue>(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current
    const isForegroundCheckInFlight = useRef(false)
    // A transition that arrives while a check is in flight must not be
    // dropped — it may be the real background hop that should raise the
    // overlay. Coalesce it into one re-run after the in-flight check settles.
    const hasPendingForegroundCheck = useRef(false)
    // Only `background` (not `inactive`) tells a real backgrounding apart from
    // banner/Face-ID noise on iOS (PERA-4870); seed from currentState so a
    // cold mount already in background isn't missed.
    const hasEnteredRealBackgroundRef = useRef(
        AppState.currentState === 'background',
    )
    // Track the lock-request version we last reacted to so that on mount we
    // don't immediately re-fire for whatever value the store happens to hold.
    const seenLockRequestVersionRef = useRef<Nullable<number>>(null)

    const recordBackground = useCallback(() => {
        setAutoLockStartedAt(Date.now())
    }, [setAutoLockStartedAt])

    const recordForeground = useCallback(
        async (transitionContext?: {
            previousState: AppStateValue
            nextState: AppStateValue
        }): Promise<void> => {
            if (isForegroundCheckInFlight.current) {
                hasPendingForegroundCheck.current = true
                return
            }

            isForegroundCheckInFlight.current = true
            try {
                do {
                    hasPendingForegroundCheck.current = false
                    // Only hide the app while deciding if it actually left
                    // the foreground.
                    const returnedFromBackground =
                        hasEnteredRealBackgroundRef.current
                    hasEnteredRealBackgroundRef.current = false
                    if (returnedFromBackground) {
                        setIsChecking(true)
                    }
                    try {
                        const expired = await checkAutoLock()
                        // One-way: only ever flip to locked. Never write
                        // `false` here — on iOS the biometric prompt briefly
                        // drives the app through inactive→active, and an
                        // `else` branch would unlock an already-locked app
                        // within milliseconds of showing the lock screen.
                        // (PERA-4196)
                        if (expired) {
                            setIsLocked(true)
                        }
                    } catch (error) {
                        logger.error('Auto-lock foreground check failed', {
                            source: 'AutoLockGuard.useAutoLockListener',
                            phase: 'foreground',
                            previousState:
                                transitionContext?.previousState ?? null,
                            nextState: transitionContext?.nextState ?? null,
                            lockEnabled: isLocked,
                            error,
                        })
                        // Keep current lock state on errors.
                    } finally {
                        setIsChecking(false)
                    }
                } while (hasPendingForegroundCheck.current)
            } finally {
                isForegroundCheckInFlight.current = false
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
        // deleteAllData skips the accounts store so the settings-flow success
        // modal can render before the route tree switches to Onboarding.
        // On the lock screen there is no success modal — clearing it here is
        // what actually drops the user back to Onboarding instead of leaving
        // them inside the app with their account list intact.
        clearAccountsStore()
        setIsChecking(false)
        setIsLocked(false)
        setAutoLockStartedAt(null)
    }, [deleteAllData, setAutoLockStartedAt])

    useEffect(() => {
        if (!isInitialized) {
            setIsChecking(true)

            void checkPinEnabled()
                .then(enabled => {
                    if (!isMounted()) {
                        return
                    }

                    setIsLocked(enabled)
                })
                .catch(error => {
                    if (!isMounted()) {
                        return
                    }

                    logger.error('Auto-lock initialization check failed', {
                        source: 'AutoLockGuard.useAutoLockListener',
                        phase: 'initialization',
                        lockEnabled: null,
                        error,
                    })
                    // Keep current lock state on errors.
                })
                .finally(() => {
                    if (!isMounted()) {
                        return
                    }

                    setIsInitialized(true)
                    setIsChecking(false)
                })
        }
    }, [checkPinEnabled, isInitialized, isMounted])

    // Honour explicit lock requests (emitted by the shake-to-lock listener and
    // by the migration flow once it finishes writing the PIN; see
    // ShakeToLockHandler and useMigrationSplashScreen). The first observation
    // seeds the ref so we don't lock on mount; subsequent changes flip isLocked
    // to true, but only when a PIN is set — locking without a PIN to unlock
    // with would strand the user.
    useEffect(() => {
        if (seenLockRequestVersionRef.current === null) {
            seenLockRequestVersionRef.current = lockRequestVersion
            return
        }
        if (lockRequestVersion === seenLockRequestVersionRef.current) {
            return
        }
        seenLockRequestVersionRef.current = lockRequestVersion

        let cancelled = false
        void (async () => {
            const enabled = await checkPinEnabled()
            if (cancelled || !enabled) return
            setIsLocked(true)
        })()
        return () => {
            cancelled = true
        }
    }, [lockRequestVersion, checkPinEnabled])

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const previousState = appState.current
            const { didLeaveForeground, didEnterForeground } =
                getAppStateTransition(
                    previousState,
                    nextAppState,
                    appStatePlatform,
                )

            if (nextAppState === 'background') {
                hasEnteredRealBackgroundRef.current = true
            }

            if (didLeaveForeground) {
                recordBackground()
            } else if (didEnterForeground) {
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
    }, [appStatePlatform, recordBackground, recordForeground])

    return {
        isLocked,
        isChecking: isChecking || !isInitialized,
        unlock,
        handleResetData: () => void handleResetData(),
    }
}
