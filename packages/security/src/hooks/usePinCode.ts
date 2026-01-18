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
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useSecurityStore } from '../store'
import {
    PIN_STORAGE_KEY,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
} from '../models'

type UsePinCodeResult = {
    isPinEnabled: boolean
    failedAttempts: number
    lockoutEndTime: number | null
    isLockedOut: boolean
    remainingLockoutSeconds: number
    savePin: (pin: string) => Promise<void>
    verifyPin: (pin: string) => Promise<boolean>
    deletePin: () => Promise<void>
    changePin: (oldPin: string, newPin: string) => Promise<boolean>
    handleFailedAttempt: () => void
    resetFailedAttempts: () => void
    getLockoutDuration: () => number
}

export const usePinCode = (): UsePinCodeResult => {
    const secureStorage = useSecureStorageService()
    const isPinEnabled = useSecurityStore(state => state.isPinEnabled)
    const setIsPinEnabled = useSecurityStore(state => state.setIsPinEnabled)
    const setIsBiometricEnabled = useSecurityStore(
        state => state.setIsBiometricEnabled,
    )
    const failedAttempts = useSecurityStore(state => state.failedAttempts)
    const incrementFailedAttempts = useSecurityStore(
        state => state.incrementFailedAttempts,
    )
    const resetFailedAttempts = useSecurityStore(
        state => state.resetFailedAttempts,
    )
    const lockoutEndTime = useSecurityStore(state => state.lockoutEndTime)
    const setLockoutEndTime = useSecurityStore(state => state.setLockoutEndTime)

    const encoder = new TextEncoder()

    const isLockedOut = lockoutEndTime !== null && Date.now() < lockoutEndTime

    const remainingLockoutSeconds = lockoutEndTime
        ? Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
        : 0

    const getLockoutDuration = useCallback(() => {
        const lockoutBlock = Math.floor(
            failedAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
        )
        if (lockoutBlock === 0) return 0
        return INITIAL_LOCKOUT_SECONDS * Math.pow(2, lockoutBlock - 1)
    }, [failedAttempts])

    const savePin = useCallback(
        async (pin: string) => {
            await secureStorage.setItem(PIN_STORAGE_KEY, encoder.encode(pin))
            setIsPinEnabled(true)
            resetFailedAttempts()
            setLockoutEndTime(null)
        },
        [
            secureStorage,
            setIsPinEnabled,
            resetFailedAttempts,
            setLockoutEndTime,
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

    const deletePin = useCallback(async () => {
        await secureStorage.removeItem(PIN_STORAGE_KEY)
        setIsPinEnabled(false)
        setIsBiometricEnabled(false)
        resetFailedAttempts()
        setLockoutEndTime(null)
    }, [
        secureStorage,
        setIsPinEnabled,
        setIsBiometricEnabled,
        resetFailedAttempts,
        setLockoutEndTime,
    ])

    const changePin = useCallback(
        async (oldPin: string, newPin: string): Promise<boolean> => {
            const isValid = await verifyPin(oldPin)
            if (!isValid) return false

            await savePin(newPin)
            return true
        },
        [verifyPin, savePin],
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

    return {
        isPinEnabled,
        failedAttempts,
        lockoutEndTime,
        isLockedOut,
        remainingLockoutSeconds,
        savePin,
        verifyPin,
        deletePin,
        changePin,
        handleFailedAttempt,
        resetFailedAttempts,
        getLockoutDuration,
    }
}
