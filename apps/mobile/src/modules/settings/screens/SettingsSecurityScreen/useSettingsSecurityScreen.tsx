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
import { PinEditContent, type PinEntryMode } from '@modules/security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

type UseSettingsSecurityScreenResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    isBiometricsAvailable: boolean
    isAdvancedSecurityEnabled: boolean
    isRekeySupportEnabled: boolean
    isAssetFreezeSupportEnabled: boolean
    handlePinToggle: (value: boolean) => void
    handleBiometricToggle: (value: boolean) => Promise<boolean>
    handleChangePinPress: () => void
    handleAdvancedSecurityToggle: (value: boolean) => void
    handleRekeyToggle: (value: boolean) => void
    handleAssetFreezeToggle: (value: boolean) => void
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
        const { request: requestBottomSheet } = useBottomSheet()

        const [isPinEnabled, setIsPinEnabled] = useState(false)

        const refreshPinState = useCallback(() => {
            checkPinEnabled().then(setIsPinEnabled)
        }, [checkPinEnabled])

        useEffect(() => {
            refreshPinState()
        }, [refreshPinState])

        const openPinSheet = useCallback(
            async (mode: PinEntryMode): Promise<boolean> => {
                const result = await requestBottomSheet<boolean>({
                    contents: (
                        <PinEditContent
                            mode={mode}
                            testID='settings_security_pin_edit_view'
                        />
                    ),
                    options: {
                        size: 'full',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                    },
                })
                return result === true
            },
            [requestBottomSheet],
        )

        const onPinFlowSuccess = useCallback(
            async (mode: PinEntryMode) => {
                if (mode === 'verify') {
                    await savePin(null)
                }
                setPreference(UserPreferences._securityPinSetupPrompt, true)
                refreshPinState()
            },
            [savePin, refreshPinState, setPreference],
        )

        const handlePinToggle = useCallback(
            async (value: boolean) => {
                const mode: PinEntryMode = value ? 'setup' : 'verify'
                const success = await openPinSheet(mode)
                if (success) {
                    await onPinFlowSuccess(mode)
                }
            },
            [openPinSheet, onPinFlowSuccess],
        )

        const handleBiometricToggle = useCallback(
            async (value: boolean): Promise<boolean> => {
                if (value) {
                    const success = await enableBiometrics({
                        title: t('security.biometric.enable_prompt_title'),
                        cancelLabel: t('security.biometric.cancel_label'),
                    })

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
            [enableBiometrics, disableBiometrics, showToast, t],
        )

        const handleChangePinPress = useCallback(async () => {
            const success = await openPinSheet('change_old')
            if (success) {
                await onPinFlowSuccess('change_old')
            }
        }, [openPinSheet, onPinFlowSuccess])

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
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
            handleAdvancedSecurityToggle,
            handleRekeyToggle,
            handleAssetFreezeToggle,
        }
    }
