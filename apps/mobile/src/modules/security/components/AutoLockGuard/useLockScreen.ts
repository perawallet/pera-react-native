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
import { useLanguage } from '@hooks/useLanguage'
import { useDuressWipe } from '@modules/security/hooks/useDuressWipe'
import { useShakeToLockHandler } from '@modules/security/hooks/useShakeToLockHandler'

type UseLockScreenParams = {
    onUnlock: () => void
    isLocked: boolean
}

type UseLockScreenResult = {
    hasError: boolean
    isLockedOut: boolean
    remainingSeconds: number
    isDuressWipeInProgress: boolean
    handlePinComplete: (pin: string) => Promise<void>
    handleErrorAnimationComplete: () => void
}

export const useLockScreen = ({
    onUnlock,
    isLocked,
}: UseLockScreenParams): UseLockScreenResult => {
    const { t } = useLanguage()
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
    const { performDuressWipe } = useDuressWipe()

    const [hasError, setHasError] = useState(false)
    const [remainingSeconds, setRemainingSeconds] = useState(0)
    const [isDuressWipeInProgress, setIsDuressWipeInProgress] = useState(false)

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
                void setLockoutEndTime(null)
            }
        }

        updateRemaining()
        const interval = setInterval(updateRemaining, 1000)

        return () => clearInterval(interval)
    }, [lockoutEndTime, isLockedOut, setLockoutEndTime])

    // Biometric auth must NOT bypass the PIN lockout. If we're already locked
    // out at mount, skip the prompt; if the user later enters the lockout via
    // failed attempts, this effect won't run again because we set the ref.
    // After a lockout expires, we still don't auto-prompt biometrics — let
    // the user enter their PIN explicitly.
    const hasAttemptedBiometricsRef = useRef(false)
    // Reset the flag every time the screen becomes locked so that the
    // biometric prompt is shown again on the next lock activation.
    const prevIsLockedRef = useRef(false)

    useEffect(() => {
        if (isLocked && !prevIsLockedRef.current) {
            hasAttemptedBiometricsRef.current = false
        }
        prevIsLockedRef.current = isLocked
    }, [isLocked])

    useEffect(() => {
        if (isLockedOut || hasAttemptedBiometricsRef.current) return
        hasAttemptedBiometricsRef.current = true

        let cancelled = false
        void (async () => {
            const enabled = await checkBiometricsEnabled()
            if (cancelled || !enabled) return
            const success = await authenticateWithBiometrics({
                title: t('security.biometric.unlock_prompt_title'),
                cancelLabel: t('security.biometric.cancel_label'),
            })
            if (cancelled || !success) return
            void resetFailedAttempts()
            onUnlock()
        })()

        return () => {
            cancelled = true
        }
    }, [
        isLockedOut,
        isLocked,
        checkBiometricsEnabled,
        authenticateWithBiometrics,
        resetFailedAttempts,
        onUnlock,
        t,
    ])

    //register shake-to-lock listener; see useShakeToLockHandler for details
    useShakeToLockHandler()

    const handlePinComplete = useCallback(
        async (pin: string) => {
            const result = await verifyPin(pin)
            if (result.kind === 'ok') {
                void resetFailedAttempts()
                onUnlock()
                return
            }
            if (result.kind === 'duress') {
                // Silent on this branch: no haptic, no error, no toast
                // useDuressWipe wipes data, provisions a decoy account, and
                // leaves us with a fresh "empty wallet" state. On any
                // internal failure, the wipe path still drops to onboarding.
                //
                // The wipe is slow; show a "logging in" overlay so it reads as
                // a normal (if sluggish) unlock rather than a frozen app.
                setIsDuressWipeInProgress(true)
                try {
                    await performDuressWipe()
                } finally {
                    onUnlock()
                    setIsDuressWipeInProgress(false)
                }
                return
            }
            void handleFailedAttempt()
            setHasError(true)
        },
        [
            verifyPin,
            resetFailedAttempts,
            handleFailedAttempt,
            onUnlock,
            performDuressWipe,
        ],
    )

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
    }, [])

    return {
        hasError,
        isLockedOut,
        remainingSeconds,
        isDuressWipeInProgress,
        handlePinComplete: (pin: string) => void handlePinComplete(pin),
        handleErrorAnimationComplete,
    }
}
