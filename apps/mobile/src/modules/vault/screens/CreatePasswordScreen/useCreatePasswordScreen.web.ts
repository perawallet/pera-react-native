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

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
    createVault,
    isPasskeyUnlockSupported,
} from '@perawallet/wallet-extension-vault-chrome'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type { PWInputRef } from '@components/core'
import { usePasskeySetupStore } from '../../hooks/usePasskeySetupStore.web'
import {
    usePasswordStrength,
    type PasswordScore,
    type PasswordStrengthError,
} from '../../hooks/usePasswordStrength.web'

type UseCreatePasswordScreenParams = { onDone: () => void }

type UseCreatePasswordScreenResult = {
    password: string
    confirmation: string
    isSubmitting: boolean
    hasError: boolean
    passwordScore: PasswordScore
    validationError: PasswordStrengthError | 'mismatch' | null
    canSubmit: boolean
    confirmationRef: RefObject<Nullable<PWInputRef>>
    setPassword: (value: string) => void
    setConfirmation: (value: string) => void
    handleSubmit: () => Promise<void>
    handlePasswordSubmitEditing: () => void
}

const validationErrorOf = (
    password: string,
    confirmation: string,
    strengthError: Nullable<PasswordStrengthError>,
): PasswordStrengthError | 'mismatch' | null => {
    if (password.length > 0 && strengthError) return strengthError
    return confirmation.length > 0 && confirmation !== password
        ? 'mismatch'
        : null
}

export const useCreatePasswordScreen = ({
    onDone,
}: UseCreatePasswordScreenParams): UseCreatePasswordScreenResult => {
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [isPasskeySupported, setIsPasskeySupported] = useState(false)
    const confirmationRef = useRef<Nullable<PWInputRef>>(null)
    const setPasskeySetupPending = usePasskeySetupStore(
        state => state.setPending,
    )

    useEffect(() => {
        let isCancelled = false
        void isPasskeyUnlockSupported().then(isSupported => {
            if (!isCancelled) setIsPasskeySupported(isSupported)
        })
        return () => {
            isCancelled = true
        }
    }, [])

    const { score: passwordScore, error: strengthError } =
        usePasswordStrength(password)

    const validationError = validationErrorOf(
        password,
        confirmation,
        strengthError,
    )

    const canSubmit =
        !strengthError && confirmation === password && !isSubmitting

    const handleSubmit = useCallback(async (): Promise<void> => {
        if (!canSubmit) return
        setIsSubmitting(true)
        setHasError(false)
        // Written before createVault: the shell re-routes the moment the
        // session key lands, and this screen unmounts with it.
        if (isPasskeySupported) {
            try {
                await setPasskeySetupPending(true)
            } catch (error) {
                // An optional step must never block creating the vault.
                logger.warn('Passkey setup flag not written', { error })
            }
        }
        try {
            await createVault(password)
            onDone()
        } catch {
            if (isPasskeySupported) {
                await setPasskeySetupPending(false).catch(() => undefined)
            }
            setHasError(true)
        } finally {
            setIsSubmitting(false)
        }
    }, [
        canSubmit,
        password,
        onDone,
        isPasskeySupported,
        setPasskeySetupPending,
    ])

    // A password manager can fill both fields at once; Enter then submits
    // rather than stopping on the already-filled confirmation.
    const handlePasswordSubmitEditing = useCallback((): void => {
        if (canSubmit) {
            void handleSubmit()
            return
        }
        confirmationRef.current?.focus()
    }, [canSubmit, handleSubmit])

    return {
        password,
        confirmation,
        isSubmitting,
        hasError,
        passwordScore,
        validationError,
        canSubmit,
        confirmationRef,
        setPassword,
        setConfirmation,
        handleSubmit,
        handlePasswordSubmitEditing,
    }
}
