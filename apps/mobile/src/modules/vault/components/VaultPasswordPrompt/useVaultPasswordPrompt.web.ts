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

import { useCallback, useEffect, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    VaultLockedOutError,
    getLockoutRemainingSeconds,
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

    // A lockout accrued elsewhere (a failed unlock, a failed password change)
    // applies here too — they all share one counter — so seed it on mount
    // rather than only discovering it on the first rejected attempt.
    useEffect(() => {
        let cancelled = false
        void getLockoutRemainingSeconds().then(seconds => {
            if (cancelled || seconds <= 0) return
            setLockoutEndTime(Date.now() + seconds * 1000)
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

    return {
        password,
        setPassword,
        isSubmitting,
        hasError,
        lockoutSeconds,
        canSubmit: password.length > 0 && !isSubmitting && lockoutSeconds === 0,
        handleSubmit,
    }
}
