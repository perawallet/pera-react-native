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
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseSettingsSecurityScreenResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    isBiometricsAvailable: boolean
    isAdvancedSecurityEnabled: boolean
    isRekeySupportEnabled: boolean
    isAssetFreezeSupportEnabled: boolean
    pinViewMode: Nullable<PinEntryMode>
    handlePinToggle: (value: boolean) => void
    handleBiometricToggle: (value: boolean) => Promise<boolean>
    handleChangePinPress: () => void
    handleAdvancedSecurityToggle: (value: boolean) => void
    handleRekeyToggle: (value: boolean) => void
    handleAssetFreezeToggle: (value: boolean) => void
    pinSetSuccess: () => void
    clearPinViewMode: () => void
}

export const useSettingsSecurityScreen =
    (): UseSettingsSecurityScreenResult => {
        const { checkPinEnabled, savePin } = usePinCode()
        const { setPreference, getPreference } = usePreferences()
        const { showToast } = useToast()
        const { t } = useLanguage()
        const {
            isEnabled: isBiometricEnabled,
            isAvailable: isBiometricsAvailable,
            enableBiometrics,
            disableBiometrics,
        } = useBiometrics()

        const [isPinEnabled, setIsPinEnabled] = useState(false)
        const [pinViewMode, setPinViewMode] =
            useState<Nullable<PinEntryMode>>(null)

        const refreshPinState = useCallback(() => {
            checkPinEnabled().then(setIsPinEnabled)
        }, [checkPinEnabled])

        useEffect(() => {
            refreshPinState()
        }, [refreshPinState])

        const handlePinToggle = useCallback(
            async (value: boolean) => {
                if (value) {
                    setPinViewMode('setup')
                } else {
                    setPinViewMode('verify')
                }
            },
            [savePin, refreshPinState],
        )

        const handleBiometricToggle = useCallback(
            async (value: boolean): Promise<boolean> => {
                if (value) {
                    const success = await enableBiometrics()

                    if (!success) {
                        showToast({
                            title: t('settings.security.biometric_error_title'),
                            body: t(
                                'settings.security.biometric_error_message',
                            ),
                            type: 'error',
                        })
                    }
                    return success
                } else {
                    await disableBiometrics()
                    return true
                }
            },
            [enableBiometrics, disableBiometrics],
        )

        const handleChangePinPress = useCallback(() => {
            setPinViewMode('change_old')
        }, [])

        const pinSetSuccess = useCallback(() => {
            if (pinViewMode === 'verify') {
                savePin(null)
            }
            setPreference(UserPreferences._securityPinSetupPrompt, true)
            refreshPinState()
            setPinViewMode(null)
        }, [pinViewMode, savePin, refreshPinState])

        const clearPinViewMode = useCallback(() => {
            setPinViewMode(null)
        }, [])

        const isAdvancedSecurityEnabled = !!getPreference(
            UserPreferences.advancedSecurityEnabled,
        )
        const isRekeySupportEnabled = !!getPreference(
            UserPreferences.rekeySupportEnabled,
        )
        const isAssetFreezeSupportEnabled = !!getPreference(
            UserPreferences.assetFreezeSupportEnabled,
        )

        const handleAdvancedSecurityToggle = useCallback(
            (value: boolean) => {
                setPreference(UserPreferences.advancedSecurityEnabled, value)
                if (!value) {
                    setPreference(UserPreferences.rekeySupportEnabled, false)
                    setPreference(
                        UserPreferences.assetFreezeSupportEnabled,
                        false,
                    )
                }
            },
            [setPreference],
        )

        const handleRekeyToggle = useCallback(
            (value: boolean) => {
                setPreference(UserPreferences.rekeySupportEnabled, value)
            },
            [setPreference],
        )

        const handleAssetFreezeToggle = useCallback(
            (value: boolean) => {
                setPreference(UserPreferences.assetFreezeSupportEnabled, value)
            },
            [setPreference],
        )

        return {
            isPinEnabled,
            isBiometricEnabled,
            isBiometricsAvailable,
            isAdvancedSecurityEnabled,
            isRekeySupportEnabled,
            isAssetFreezeSupportEnabled,
            pinViewMode,
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
            handleAdvancedSecurityToggle,
            handleRekeyToggle,
            handleAssetFreezeToggle,
            clearPinViewMode,
            pinSetSuccess,
        }
    }
