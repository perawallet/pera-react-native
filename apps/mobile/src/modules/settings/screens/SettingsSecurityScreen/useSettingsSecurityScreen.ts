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
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { PinEntryMode } from '@modules/security/components/PinEditView/usePinEditView'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

type UseSettingsSecurityScreenResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    isBiometricsAvailable: boolean
    pinViewMode: PinEntryMode | null
    handlePinToggle: (value: boolean) => void
    handleBiometricToggle: (value: boolean) => Promise<boolean>
    handleChangePinPress: () => void
    pinSetSuccess: () => void
    clearPinViewMode: () => void
}

export const useSettingsSecurityScreen =
    (): UseSettingsSecurityScreenResult => {
        const { checkPinEnabled, savePin } = usePinCode()
        const { setPreference } = usePreferences()
        const {
            checkBiometricsEnabled,
            checkBiometricsAvailable,
            enableBiometrics,
            disableBiometrics,
        } = useBiometrics()

        const [isPinEnabled, setIsPinEnabled] = useState(false)
        const [isBiometricEnabled, setIsBiometricEnabled] = useState(false)
        const [isBiometricsAvailable, setIsBiometricsAvailable] =
            useState(false)
        const [pinViewMode, setPinViewMode] = useState<PinEntryMode | null>(
            null,
        )

        const updateSettings = useCallback(() => {
            checkBiometricsAvailable().then(setIsBiometricsAvailable)
            checkPinEnabled().then(setIsPinEnabled)
            checkBiometricsEnabled().then(setIsBiometricEnabled)
        }, [checkBiometricsAvailable, checkPinEnabled, checkBiometricsEnabled])

        useEffect(() => {
            updateSettings()
        }, [updateSettings])

        const handlePinToggle = useCallback(
            async (value: boolean) => {
                if (value) {
                    setPinViewMode('setup')
                } else {
                    setPinViewMode('verify')
                }
            },
            [savePin, updateSettings],
        )

        const handleBiometricToggle = useCallback(
            async (value: boolean): Promise<boolean> => {
                if (value) {
                    const success = await enableBiometrics()
                    return success
                } else {
                    await disableBiometrics()
                    updateSettings()
                    return true
                }
            },
            [enableBiometrics, disableBiometrics, updateSettings],
        )

        const handleChangePinPress = useCallback(() => {
            setPinViewMode('change_old')
        }, [])

        const pinSetSuccess = useCallback(() => {
            if (pinViewMode === 'verify') {
                savePin(null)
            }
            setPreference(UserPreferences.securityPinSetupPrompt, true)
            updateSettings()
            setPinViewMode(null)
        }, [pinViewMode, savePin, updateSettings])

        const clearPinViewMode = useCallback(() => {
            setPinViewMode(null)
        }, [])

        return {
            isPinEnabled,
            isBiometricEnabled,
            isBiometricsAvailable,
            pinViewMode,
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
            clearPinViewMode,
            pinSetSuccess,
        }
    }
