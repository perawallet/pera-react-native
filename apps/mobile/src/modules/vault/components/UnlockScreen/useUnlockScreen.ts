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

import { useCallback, useEffect, useState } from 'react'
import {
    InvalidPasswordError,
    PasskeyUnlockError,
    VaultCorruptedError,
    VaultLockedOutError,
    getLockoutRemainingSeconds,
    isPasskeyUnlockEnabled,
    isPasskeyUnlockSupported,
    unlockVault,
    unlockWithPasskey,
} from '@perawallet/wallet-extension-keystore-chrome'

type UseUnlockScreenResult = {
    password: string
    isSubmitting: boolean
    hasError: boolean
    hasCorruptedVaultError: boolean
    hasPasskeyError: boolean
    canUsePasskey: boolean
    lockoutSeconds: number
    setPassword: (value: string) => void
    handleUnlock: () => Promise<void>
    handlePasskeyUnlock: () => Promise<void>
}

export const useUnlockScreen = (): UseUnlockScreenResult => {
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [hasCorruptedVaultError, setHasCorruptedVaultError] = useState(false)
    const [hasPasskeyError, setHasPasskeyError] = useState(false)
    const [canUsePasskey, setCanUsePasskey] = useState(false)
    // Absolute end time (not exposed) drives the countdown below — mirrors
    // useLockScreen.ts, which keys the single interval off lockoutEndTime
    // rather than the tick count, so it isn't torn down and recreated
    // every second.
    const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
    const [lockoutSeconds, setLockoutSeconds] = useState(0)

    useEffect(() => {
        let cancelled = false
        const check = async (): Promise<void> => {
            const [supported, enabled] = await Promise.all([
                isPasskeyUnlockSupported(),
                isPasskeyUnlockEnabled(),
            ])
            if (!cancelled) {
                setCanUsePasskey(supported && enabled)
            }
        }
        void check()
        return () => {
            cancelled = true
        }
    }, [])

    // Hydrate from the persisted lockout record so a popup re-open (or the
    // initial mount) still honors a lockout started in a previous session.
    useEffect(() => {
        let cancelled = false
        void getLockoutRemainingSeconds().then(seconds => {
            if (!cancelled && seconds > 0) {
                setLockoutEndTime(Date.now() + seconds * 1000)
            }
        })
        return () => {
            cancelled = true
        }
    }, [])

    // 1s countdown while locked out, mirroring useLockScreen.ts (mobile PIN
    // lockout) lines 54-76.
    useEffect(() => {
        if (lockoutEndTime === null) {
            setLockoutSeconds(0)
            return
        }
        const updateRemaining = (): void => {
            const remaining = Math.max(
                0,
                Math.ceil((lockoutEndTime - Date.now()) / 1000),
            )
            setLockoutSeconds(remaining)
            if (remaining === 0) setLockoutEndTime(null)
        }
        updateRemaining()
        const interval = setInterval(updateRemaining, 1000)
        return () => clearInterval(interval)
    }, [lockoutEndTime])

    const handleUnlock = useCallback(async (): Promise<void> => {
        if (password.length === 0 || isSubmitting || lockoutSeconds > 0) return
        setIsSubmitting(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockVault(password)
            setPassword('')
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
                setPassword('')
            } else if (error instanceof VaultCorruptedError) {
                setHasCorruptedVaultError(true)
                setPassword('')
            } else if (error instanceof InvalidPasswordError) {
                setHasError(true)
                setPassword('')
                const seconds = await getLockoutRemainingSeconds()
                if (seconds > 0) setLockoutEndTime(Date.now() + seconds * 1000)
            } else {
                throw error
            }
        } finally {
            setIsSubmitting(false)
        }
    }, [password, isSubmitting, lockoutSeconds])

    const handlePasskeyUnlock = useCallback(async (): Promise<void> => {
        if (isSubmitting || lockoutSeconds > 0) return
        setIsSubmitting(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockWithPasskey()
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
            } else if (error instanceof VaultCorruptedError) {
                setHasCorruptedVaultError(true)
            } else if (
                error instanceof DOMException &&
                error.name === 'NotAllowedError'
            ) {
                // User cancelled the passkey prompt — treat as silent no-op.
            } else if (error instanceof PasskeyUnlockError) {
                setHasPasskeyError(true)
            } else {
                throw error
            }
        } finally {
            setIsSubmitting(false)
        }
    }, [isSubmitting, lockoutSeconds])

    return {
        password,
        isSubmitting,
        hasError,
        hasCorruptedVaultError,
        hasPasskeyError,
        canUsePasskey,
        lockoutSeconds,
        setPassword,
        handleUnlock,
        handlePasskeyUnlock,
    }
}
