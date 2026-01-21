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

import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { useLanguage } from '@hooks/useLanguage'

export type PinEntryMode = 'setup' | 'confirm' | 'verify' | 'change_old'

type UsePinEditViewParams = {
    mode: PinEntryMode | null
    onSuccess?: () => void
}

type UsePinEditViewResult = {
    title: string
    hasError: boolean
    isDisabled: boolean
    handlePinComplete: (pin: string) => void
    handleBiometricPress: () => void
    handleErrorAnimationComplete: () => void
}

export const usePinEditView = ({
    mode,
    onSuccess,
}: UsePinEditViewParams): UsePinEditViewResult => {
    const { t } = useLanguage()
    const {
        savePin,
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        isLockedOut,
    } = usePinCode()
    const { checkBiometricsEnabled, authenticateWithBiometrics } =
        useBiometrics()

    const [currentMode, setCurrentMode] = useState<PinEntryMode | null>(mode)
    const [storedPin, setStoredPin] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    const title = useMemo(() => {
        switch (currentMode) {
            case 'setup':
                return t('security.pin.setup_title')
            case 'confirm':
                return t('security.pin.confirm_title')
            case 'verify':
                return t('security.pin.verify_title')
            case 'change_old':
                return t('security.pin.change_old_title')
            default:
                return ''
        }
    }, [currentMode, t])

    // TODO: revisit this: it's a little clunky to be managing the state internally and externally
    useEffect(() => {
        setCurrentMode(mode)
    }, [mode])

    const handlePinComplete = useCallback(
        async (pin: string) => {
            switch (currentMode) {
                case 'setup':
                    setStoredPin(pin)
                    setHasError(false)
                    setCurrentMode('confirm')
                    break
                case 'confirm':
                    if (pin === storedPin) {
                        await savePin(pin)
                        setHasError(false)
                        onSuccess?.()
                    } else {
                        setHasError(true)
                    }
                    break
                case 'change_old':
                case 'verify': {
                    const isValid = await verifyPin(pin)
                    if (isValid) {
                        resetFailedAttempts()
                        setHasError(false)
                        if (currentMode === 'change_old') {
                            setCurrentMode('setup')
                        } else {
                            onSuccess?.()
                        }
                    } else {
                        handleFailedAttempt()
                        setHasError(true)
                    }
                    break
                }
            }
        },
        [
            currentMode,
            storedPin,
            savePin,
            verifyPin,
            handleFailedAttempt,
            resetFailedAttempts,
            onSuccess,
        ],
    )

    const handleBiometricPress = useCallback(async () => {
        const enabled = await checkBiometricsEnabled()
        if (!enabled) return

        const success = await authenticateWithBiometrics()
        if (success) {
            resetFailedAttempts()
            onSuccess?.()
        }
    }, [
        checkBiometricsEnabled,
        authenticateWithBiometrics,
        resetFailedAttempts,
        onSuccess,
    ])

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
    }, [])

    return {
        title,
        hasError,
        isDisabled: isLockedOut,
        handlePinComplete,
        handleBiometricPress,
        handleErrorAnimationComplete,
    }
}
