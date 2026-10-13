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

import { useCallback, useState } from 'react'
import { createVault } from '@perawallet/wallet-extension-keystore-chrome'
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
    setPassword: (value: string) => void
    setConfirmation: (value: string) => void
    handleSubmit: () => Promise<void>
}

export const useCreatePasswordScreen = ({
    onDone,
}: UseCreatePasswordScreenParams): UseCreatePasswordScreenResult => {
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasError, setHasError] = useState(false)

    const { score: passwordScore, error: strengthError } =
        usePasswordStrength(password)

    const validationError =
        password.length > 0 && strengthError
            ? strengthError
            : confirmation.length > 0 && confirmation !== password
              ? ('mismatch' as const)
              : null

    const canSubmit =
        !strengthError && confirmation === password && !isSubmitting

    const handleSubmit = useCallback(async (): Promise<void> => {
        if (!canSubmit) return
        setIsSubmitting(true)
        setHasError(false)
        try {
            await createVault(password)
            onDone()
        } catch {
            setHasError(true)
        } finally {
            setIsSubmitting(false)
        }
    }, [canSubmit, password, onDone])

    return {
        password,
        confirmation,
        isSubmitting,
        hasError,
        passwordScore,
        validationError,
        canSubmit,
        setPassword,
        setConfirmation,
        handleSubmit,
    }
}
