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
import { logger } from '@perawallet/wallet-core-shared'
import {
    PasskeyUnlockError,
    VaultCorruptedError,
    VaultLockedOutError,
    getLockoutRemainingSeconds,
    isPasskeyUnlockEnabled,
    isPasskeyUnlockSupported,
    verifyPasskey,
    verifyVaultPassword,
} from '@perawallet/wallet-extension-keystore-chrome'

type UseVaultPasswordPromptParams = {
    onVerified: () => void
}

type UseVaultPasswordPromptResult = {
    password: string
    setPassword: (value: string) => void
    isSubmitting: boolean
    hasError: boolean
    lockoutSeconds: number
    canSubmit: boolean
    handleSubmit: () => Promise<void>
    canUsePasskey: boolean
    isPasskeyPending: boolean
    hasPasskeyError: boolean
    handlePasskeyVerify: () => Promise<void>
}

/**
 * Re-authentication for a user who is already unlocked. Distinct from
 * `useUnlockScreen`: nothing here unlocks the vault or touches the session key
 * — it only proves the person at the keyboard knows the password before a
 * high-consequence action (revealing a recovery phrase, or asserting a
 * WebAuthn credential to a relying party that asked for user verification).
 */
export const useVaultPasswordPrompt = ({
    onVerified,
}: UseVaultPasswordPromptParams): UseVaultPasswordPromptResult => {
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
    const [lockoutSeconds, setLockoutSeconds] = useState(0)
    // Tracked separately from isSubmitting so the password stays submittable
    // while a passkey prompt is outstanding — see the auto-launch effect below.
    const [isPasskeyPending, setIsPasskeyPending] = useState(false)
    const [hasPasskeyError, setHasPasskeyError] = useState(false)
    const [canUsePasskey, setCanUsePasskey] = useState(false)
    const [isPasskeySupportChecked, setIsPasskeySupportChecked] =
        useState(false)
    const [isLockoutChecked, setIsLockoutChecked] = useState(false)
    // Burned on the first DECISION the auto-launch effect can make, not on a
    // successful launch — see that effect's comment.
    const hasAutoLaunchedRef = useRef(false)
    // A manual "Use Passkey" tap can land before both probes resolve; if the
    // user already tried and cancelled, auto-launch must not fire a second
    // prompt once it becomes ready to decide.
    const hasAttemptedPasskeyRef = useRef(false)

    useEffect(() => {
        let cancelled = false
        const check = async (): Promise<void> => {
            const [supported, enabled] = await Promise.all([
                isPasskeyUnlockSupported(),
                isPasskeyUnlockEnabled(),
            ])
            if (!cancelled) {
                setCanUsePasskey(supported && enabled)
                setIsPasskeySupportChecked(true)
            }
        }
        void check()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (isPasskeyPending) hasAttemptedPasskeyRef.current = true
    }, [isPasskeyPending])

    // A lockout accrued elsewhere (a failed unlock, a failed password change)
    // applies here too — they all share one counter — so seed it on mount
    // rather than only discovering it on the first rejected attempt.
    useEffect(() => {
        let cancelled = false
        void getLockoutRemainingSeconds().then(seconds => {
            if (cancelled) return
            if (seconds > 0) {
                setLockoutEndTime(Date.now() + seconds * 1000)
                // Set lockoutSeconds in the same batch as isLockoutChecked.
                // Otherwise it only gets its first value from the countdown
                // effect reacting to lockoutEndTime, one commit later — and the
                // auto-launch effect would see isLockoutChecked: true beside a
                // stale lockoutSeconds: 0 and launch anyway.
                setLockoutSeconds(seconds)
            }
            setIsLockoutChecked(true)
        })
        return () => {
            cancelled = true
        }
    }, [])

    // Single interval keyed off the absolute end time (not the tick count) so
    // it isn't torn down and recreated every second — mirrors useUnlockScreen.
    useEffect(() => {
        if (lockoutEndTime === null) {
            setLockoutSeconds(0)
            return
        }
        const tick = (): void => {
            const remaining = Math.max(
                0,
                Math.ceil((lockoutEndTime - Date.now()) / 1000),
            )
            setLockoutSeconds(remaining)
            if (remaining === 0) setLockoutEndTime(null)
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [lockoutEndTime])

    const handleSubmit = useCallback(async (): Promise<void> => {
        if (!password || isSubmitting || lockoutSeconds > 0) return
        setIsSubmitting(true)
        setHasError(false)
        setHasPasskeyError(false)
        try {
            const verified = await verifyVaultPassword(password)
            if (verified) {
                setPassword('')
                onVerified()
                return
            }
            setHasError(true)
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
                return
            }
            // Corruption or a storage failure — surface as a generic failure
            // rather than a wrong-password hint, which would be misleading.
            logger.error('Vault re-authentication failed', { error })
            setHasError(true)
        } finally {
            setIsSubmitting(false)
        }
    }, [password, isSubmitting, lockoutSeconds, onVerified])

    const handlePasskeyVerify = useCallback(async (): Promise<void> => {
        if (isPasskeyPending || isSubmitting || lockoutSeconds > 0) return
        setIsPasskeyPending(true)
        setHasError(false)
        setHasPasskeyError(false)
        try {
            await verifyPasskey()
            onVerified()
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
                setLockoutSeconds(error.remainingSeconds)
            } else if (
                error instanceof DOMException &&
                error.name === 'NotAllowedError'
            ) {
                // User cancelled the prompt — silent no-op, the sheet stays
                // open on the password.
            } else if (
                error instanceof PasskeyUnlockError ||
                error instanceof VaultCorruptedError
            ) {
                setHasPasskeyError(true)
            } else {
                logger.error('Vault passkey re-authentication failed', {
                    error,
                })
                setHasPasskeyError(true)
            }
        } finally {
            setIsPasskeyPending(false)
        }
    }, [isPasskeyPending, isSubmitting, lockoutSeconds, onVerified])

    // Launch the challenge as soon as we know a passkey is available, rather
    // than making the user tap "Use Passkey" first.
    //
    // hasAutoLaunchedRef is burned on the first DECISION, not on a successful
    // launch: once both mount probes have resolved this effect commits to
    // launching now or never launching automatically again this mount. That is
    // what stops a user who arrives already locked out from getting an
    // unprompted biometric dialog when the countdown reaches zero.
    //
    // The password stays fully available while the prompt is outstanding —
    // handleSubmit gates on isSubmitting only.
    useEffect(() => {
        if (hasAutoLaunchedRef.current) return
        if (!isLockoutChecked || !isPasskeySupportChecked) return
        hasAutoLaunchedRef.current = true
        if (hasAttemptedPasskeyRef.current) return
        if (!canUsePasskey || lockoutSeconds > 0 || isSubmitting) return
        void handlePasskeyVerify()
    }, [
        isLockoutChecked,
        isPasskeySupportChecked,
        canUsePasskey,
        lockoutSeconds,
        isSubmitting,
        handlePasskeyVerify,
    ])

    return {
        password,
        setPassword,
        isSubmitting,
        hasError,
        lockoutSeconds,
        canSubmit: password.length > 0 && !isSubmitting && lockoutSeconds === 0,
        handleSubmit,
        canUsePasskey,
        isPasskeyPending,
        hasPasskeyError,
        handlePasskeyVerify,
    }
}
