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

import { useCallback, useMemo, useRef } from 'react'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useSecurityStore } from '../store'
import {
    PIN_STORAGE_KEY,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
    AUTO_LOCK_TIMEOUT_MS,
} from '../constants'
import { useBiometrics } from './useBiometrics'

type UsePinCodeResult = {
    failedAttempts: number
    lockoutEndTime: number | null
    isLockedOut: boolean
    remainingLockoutSeconds: number
    checkAutoLock: () => Promise<boolean>
    checkPinEnabled: () => Promise<boolean>
    savePin: (pin: string | null) => Promise<void>
    verifyPin: (pin: string) => Promise<boolean>
    handleFailedAttempt: () => void
    resetFailedAttempts: () => void
    setLockoutEndTime: (date: number | null) => void
    getLockoutDuration: () => number
    setAutoLockStartedAt: (date: number | null) => void
}

const encoder = new TextEncoder()

export const usePinCode = (): UsePinCodeResult => {
    const forceRefresh = useRef(0)
    const secureStorage = useSecureStorageService()
    const failedAttempts = useSecurityStore(state => state.failedAttempts)
    const incrementFailedAttempts = useSecurityStore(
        state => state.incrementFailedAttempts,
    )
    const resetFailedAttemptsInStore = useSecurityStore(
        state => state.resetFailedAttempts,
    )
    const lockoutEndTime = useSecurityStore(state => state.lockoutEndTime)
    const setLockoutEndTime = useSecurityStore(state => state.setLockoutEndTime)
    const autoLockStartedAt = useSecurityStore(state => state.autoLockStartedAt)
    const setAutoLockStartedAt = useSecurityStore(
        state => state.setAutoLockStartedAt,
    )

    const { checkBiometricsEnabled, disableBiometrics, setBiometricsCode } =
        useBiometrics()

    const isLockedOut = useMemo(
        () => lockoutEndTime !== null && Date.now() < lockoutEndTime,
        [lockoutEndTime],
    )

    const remainingLockoutSeconds = lockoutEndTime
        ? Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
        : 0

    const checkPinEnabled = useCallback(async (): Promise<boolean> => {
        const pinData = await secureStorage.getItem(PIN_STORAGE_KEY)
        return !!pinData
    }, [secureStorage, forceRefresh.current])

    const setIsPinEnabled = useCallback(
        async (code: string | null): Promise<void> => {
            if (code) {
                await secureStorage.setItem(
                    PIN_STORAGE_KEY,
                    encoder.encode(code),
                )
                const isBiometricEnabled = await checkBiometricsEnabled()
                if (isBiometricEnabled) {
                    await setBiometricsCode(encoder.encode(code))
                }
            } else {
                await secureStorage.removeItem(PIN_STORAGE_KEY)
                disableBiometrics()
            }
            forceRefresh.current += 1
            resetFailedAttempts()
            setLockoutEndTime(null)
        },
        [secureStorage, encoder],
    )

    const getLockoutDuration = useCallback(() => {
        const lockoutBlock = Math.floor(
            failedAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
        )
        if (lockoutBlock === 0) return 0
        return INITIAL_LOCKOUT_SECONDS * Math.pow(2, lockoutBlock - 1)
    }, [failedAttempts])

    const resetFailedAttempts = useCallback(() => {
        resetFailedAttemptsInStore()
        setLockoutEndTime(null)
    }, [resetFailedAttemptsInStore])

    const savePin = useCallback(
        async (pin: string | null) => {
            setIsPinEnabled(pin)
            if (await checkBiometricsEnabled()) {
                if (pin) {
                    await setBiometricsCode(encoder.encode(pin))
                } else {
                    await disableBiometrics()
                }
            }
            forceRefresh.current += 1
            resetFailedAttempts()
            setLockoutEndTime(null)
        },
        [
            secureStorage,
            setIsPinEnabled,
            resetFailedAttempts,
            setLockoutEndTime,
            checkBiometricsEnabled,
            encoder,
        ],
    )

    const verifyPin = useCallback(
        async (pin: string): Promise<boolean> => {
            const storedPinData = await secureStorage.getItem(PIN_STORAGE_KEY)
            if (!storedPinData) return false

            const storedPin = new TextDecoder().decode(storedPinData)
            return pin === storedPin
        },
        [secureStorage],
    )

    const handleFailedAttempt = useCallback(() => {
        incrementFailedAttempts()
        const newAttempts = failedAttempts + 1
        const remainder = newAttempts % MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT

        if (remainder === 0) {
            const lockoutBlock = Math.floor(
                newAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
            )
            const lockoutSeconds =
                INITIAL_LOCKOUT_SECONDS * Math.pow(2, lockoutBlock - 1)
            setLockoutEndTime(Date.now() + lockoutSeconds * 1000)
        }
    }, [incrementFailedAttempts, failedAttempts, setLockoutEndTime])

    const checkAutoLock = useCallback(async () => {
        if (!(await checkPinEnabled())) return false
        if (autoLockStartedAt == null) return false
        const elapsed = Date.now() - autoLockStartedAt
        return elapsed > AUTO_LOCK_TIMEOUT_MS
    }, [autoLockStartedAt])

    return {
        checkPinEnabled,
        failedAttempts,
        lockoutEndTime,
        isLockedOut,
        checkAutoLock,
        remainingLockoutSeconds,
        savePin,
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        getLockoutDuration,
        setLockoutEndTime,
        setAutoLockStartedAt,
    }
}
