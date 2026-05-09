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

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'

type UseLockScreenParams = {
    onUnlock: () => void
}

type UseLockScreenResult = {
    hasError: boolean
    isLockedOut: boolean
    remainingSeconds: number
    handlePinComplete: (pin: string) => void
    handleErrorAnimationComplete: () => void
}

export const useLockScreen = ({
    onUnlock,
}: UseLockScreenParams): UseLockScreenResult => {
    const {
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        isLockedOut,
        lockoutEndTime,
        setLockoutEndTime,
    } = usePinCode()
    const { checkBiometricsEnabled, authenticateWithBiometrics } =
        useBiometrics()

    const [hasError, setHasError] = useState(false)
    const [remainingSeconds, setRemainingSeconds] = useState(0)

    useEffect(() => {
        if (!isLockedOut || !lockoutEndTime) {
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
            if (remaining === 0) {
                setLockoutEndTime(null)
            }
        }

        updateRemaining()
        const interval = setInterval(updateRemaining, 1000)

        return () => clearInterval(interval)
    }, [lockoutEndTime])

    // Biometric auth must NOT bypass the PIN lockout. If we're already locked
    // out at mount, skip the prompt; if the user later enters the lockout via
    // failed attempts, this effect won't run again because we set the ref.
    // After a lockout expires, we still don't auto-prompt biometrics — let
    // the user enter their PIN explicitly.
    const hasAttemptedBiometricsRef = useRef(false)

    useEffect(() => {
        if (isLockedOut || hasAttemptedBiometricsRef.current) return
        hasAttemptedBiometricsRef.current = true

        let cancelled = false
        ;(async () => {
            const enabled = await checkBiometricsEnabled()
            if (cancelled || !enabled) return
            const success = await authenticateWithBiometrics()
            if (cancelled || !success) return
            resetFailedAttempts()
            onUnlock()
        })()

        return () => {
            cancelled = true
        }
    }, [
        isLockedOut,
        checkBiometricsEnabled,
        authenticateWithBiometrics,
        resetFailedAttempts,
        onUnlock,
    ])

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

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
    }, [])

    return {
        hasError,
        isLockedOut,
        remainingSeconds,
        handlePinComplete,
        handleErrorAnimationComplete,
    }
}
