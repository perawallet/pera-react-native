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

import { useState, useCallback } from 'react'
import {
    usePinCode,
    useBiometrics,
} from '@perawallet/wallet-core-security'
import type { PinEntryMode } from '@modules/security/components/PinEntry'
import { useLanguage } from '@hooks/useLanguage'

type UsePinEntryScreenParams = {
    mode: PinEntryMode
    onSuccess?: () => void
}

type UsePinEntryScreenResult = {
    currentMode: PinEntryMode
    title: string
    subtitle?: string
    hasError: boolean
    isDisabled: boolean
    showBiometric: boolean
    handlePinComplete: (pin: string) => void
    handleBiometricPress: () => void
    handleErrorAnimationComplete: () => void
}

export const usePinEntryScreen = ({
    mode,
    onSuccess,
}: UsePinEntryScreenParams): UsePinEntryScreenResult => {
    const { t } = useLanguage()
    const {
        savePin,
        verifyPin,
        changePin,
        handleFailedAttempt,
        resetFailedAttempts,
        isLockedOut,
    } = usePinCode()
    const { isBiometricEnabled, authenticateWithBiometrics } = useBiometrics()

    const [currentMode, setCurrentMode] = useState<PinEntryMode>(mode)
    const [setupPin, setSetupPin] = useState<string>('')
    const [oldPin, setOldPin] = useState<string>('')
    const [newPin, setNewPin] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    const getTitleAndSubtitle = useCallback(() => {
        switch (currentMode) {
            case 'setup':
                return {
                    title: t('security.pin.setup_title'),
                    subtitle: t('security.pin.setup_subtitle'),
                }
            case 'confirm':
                return {
                    title: t('security.pin.confirm_title'),
                    subtitle: t('security.pin.confirm_subtitle'),
                }
            case 'verify':
                return {
                    title: t('security.pin.verify_title'),
                    subtitle: undefined,
                }
            case 'change_old':
                return {
                    title: t('security.pin.change_old_title'),
                    subtitle: undefined,
                }
            case 'change_new':
                return {
                    title: t('security.pin.change_new_title'),
                    subtitle: undefined,
                }
            case 'change_confirm':
                return {
                    title: t('security.pin.change_confirm_title'),
                    subtitle: undefined,
                }
            default:
                return { title: '', subtitle: undefined }
        }
    }, [currentMode, t])

    const { title, subtitle } = getTitleAndSubtitle()

    const handlePinComplete = useCallback(
        async (pin: string) => {
            switch (currentMode) {
                case 'setup':
                    setSetupPin(pin)
                    setCurrentMode('confirm')
                    break

                case 'confirm':
                    if (pin === setupPin) {
                        await savePin(pin)
                        onSuccess?.()
                    } else {
                        setHasError(true)
                    }
                    break

                case 'verify': {
                    const isValid = await verifyPin(pin)
                    if (isValid) {
                        resetFailedAttempts()
                        onSuccess?.()
                    } else {
                        handleFailedAttempt()
                        setHasError(true)
                    }
                    break
                }

                case 'change_old': {
                    const isValid = await verifyPin(pin)
                    if (isValid) {
                        setOldPin(pin)
                        setCurrentMode('change_new')
                    } else {
                        setHasError(true)
                    }
                    break
                }

                case 'change_new':
                    setNewPin(pin)
                    setCurrentMode('change_confirm')
                    break

                case 'change_confirm':
                    if (pin === newPin) {
                        await changePin(oldPin, pin)
                        onSuccess?.()
                    } else {
                        setHasError(true)
                    }
                    break
            }
        },
        [
            currentMode,
            setupPin,
            oldPin,
            newPin,
            savePin,
            verifyPin,
            changePin,
            handleFailedAttempt,
            resetFailedAttempts,
            onSuccess,
        ],
    )

    const handleBiometricPress = useCallback(async () => {
        if (!isBiometricEnabled) return

        const success = await authenticateWithBiometrics()
        if (success) {
            resetFailedAttempts()
            onSuccess?.()
        }
    }, [
        isBiometricEnabled,
        authenticateWithBiometrics,
        resetFailedAttempts,
        onSuccess,
    ])

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
        if (currentMode === 'confirm') {
            setSetupPin('')
            setCurrentMode('setup')
        } else if (currentMode === 'change_confirm') {
            setNewPin('')
            setCurrentMode('change_new')
        }
    }, [currentMode])

    return {
        currentMode,
        title,
        subtitle,
        hasError,
        isDisabled: isLockedOut,
        showBiometric: isBiometricEnabled && currentMode === 'verify',
        handlePinComplete,
        handleBiometricPress,
        handleErrorAnimationComplete,
    }
}
