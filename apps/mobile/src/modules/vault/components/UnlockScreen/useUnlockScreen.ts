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

    const handleUnlock = useCallback(async (): Promise<void> => {
        if (password.length === 0 || isSubmitting) return
        setIsSubmitting(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockVault(password)
            setPassword('')
        } catch (error) {
            if (error instanceof VaultCorruptedError) {
                setHasCorruptedVaultError(true)
                setPassword('')
            } else if (error instanceof InvalidPasswordError) {
                setHasError(true)
                setPassword('')
            } else {
                throw error
            }
        } finally {
            setIsSubmitting(false)
        }
    }, [password, isSubmitting])

    const handlePasskeyUnlock = useCallback(async (): Promise<void> => {
        if (isSubmitting) return
        setIsSubmitting(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockWithPasskey()
        } catch (error) {
            if (error instanceof VaultCorruptedError) {
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
    }, [isSubmitting])

    return {
        password,
        isSubmitting,
        hasError,
        hasCorruptedVaultError,
        hasPasskeyError,
        canUsePasskey,
        setPassword,
        handleUnlock,
        handlePasskeyUnlock,
    }
}
