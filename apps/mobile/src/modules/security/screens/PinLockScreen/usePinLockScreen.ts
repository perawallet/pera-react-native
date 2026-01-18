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

import { useState, useCallback, useEffect } from 'react'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'

type UsePinLockScreenParams = {
    onUnlock: () => void
}

type UsePinLockScreenResult = {
    hasError: boolean
    isLockedOut: boolean
    remainingSeconds: number
    showBiometric: boolean
    handlePinComplete: (pin: string) => void
    handleBiometricPress: () => void
    handleErrorAnimationComplete: () => void
}

export const usePinLockScreen = ({
    onUnlock,
}: UsePinLockScreenParams): UsePinLockScreenResult => {
    const {
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        isLockedOut,
        lockoutEndTime,
    } = usePinCode()
    const { isBiometricEnabled, authenticateWithBiometrics } = useBiometrics()

    const [hasError, setHasError] = useState(false)
    const [remainingSeconds, setRemainingSeconds] = useState(0)

    useEffect(() => {
        if (!lockoutEndTime) {
            setRemainingSeconds(0)
            return
        }

        const updateRemaining = () => {
            const now = Date.now()
            const remaining = Math.max(
                0,
                Math.ceil((lockoutEndTime - now) / 1000),
            )
            setRemainingSeconds(remaining)
        }

        updateRemaining()
        const interval = setInterval(updateRemaining, 1000)

        return () => clearInterval(interval)
    }, [lockoutEndTime])

    useEffect(() => {
        if (isBiometricEnabled) {
            handleBiometricPress()
        }
    }, [])

    const handlePinComplete = useCallback(
        async (pin: string) => {
            const isValid = await verifyPin(pin)
            if (isValid) {
                resetFailedAttempts()
                onUnlock()
            } else {
                handleFailedAttempt()
                setHasError(true)
            }
        },
        [verifyPin, resetFailedAttempts, handleFailedAttempt, onUnlock],
    )

    const handleBiometricPress = useCallback(async () => {
        if (!isBiometricEnabled) return

        const success = await authenticateWithBiometrics()
        if (success) {
            resetFailedAttempts()
            onUnlock()
        }
    }, [
        isBiometricEnabled,
        authenticateWithBiometrics,
        resetFailedAttempts,
        onUnlock,
    ])

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
    }, [])

    return {
        hasError,
        isLockedOut,
        remainingSeconds,
        showBiometric: isBiometricEnabled,
        handlePinComplete,
        handleBiometricPress,
        handleErrorAnimationComplete,
    }
}
