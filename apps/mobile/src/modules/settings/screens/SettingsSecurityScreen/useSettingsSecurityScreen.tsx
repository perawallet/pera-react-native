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
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { PinEditContent, type PinEntryMode } from '@modules/security'
import type { SavePinHandlerResult } from '@modules/security/components/PinEditView/usePinEditView'
import { useBottomSheet } from '@modules/bottom-sheet'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
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
    isShakeToLockFeatureEnabled: boolean
    isShakeToLockEnabled: boolean
    isDuressPinFeatureEnabled: boolean
    isDuressPinEnabled: boolean
    handlePinToggle: (value: boolean) => Promise<void>
    handleBiometricToggle: (value: boolean) => Promise<boolean>
    handleChangePinPress: () => Promise<void>
    handleRekeyToggle: (value: boolean) => void
    handleAssetFreezeToggle: (value: boolean) => void
    handleShakeToLockToggle: (value: boolean) => void
    handleDuressPinToggle: (value: boolean) => Promise<void>
}

export const useSettingsSecurityScreen =
    (): UseSettingsSecurityScreenResult => {
        const {
            checkPinEnabled,
            savePin,
            verifyPin,
            saveDuressPin,
            checkDuressPinEnabled,
        } = usePinCode()
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
        const remoteConfig = useRemoteConfig()
        const isShakeToLockFeatureEnabled = remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_motion_lock,
            false,
        )
        const isDuressPinFeatureEnabled = remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_duress_pin,
            false,
        )

        const [isPinEnabled, setIsPinEnabled] = useState(false)
        const [isDuressPinEnabled, setIsDuressPinEnabled] = useState(false)

        const refreshPinState = useCallback(() => {
            void checkPinEnabled().then(setIsPinEnabled)
            void checkDuressPinEnabled().then(setIsDuressPinEnabled)
        }, [checkPinEnabled, checkDuressPinEnabled])

        useEffect(() => {
            refreshPinState()
        }, [refreshPinState])

        const openPinSheet = useCallback(
            async (
                mode: PinEntryMode,
                options?: {
                    savePinHandler?: (
                        pin: string,
                    ) => Promise<SavePinHandlerResult>
                },
            ): Promise<boolean> => {
                const result = await requestBottomSheet<boolean>({
                    contents: (
                        <PinEditContent
                            mode={mode}
                            testID='settings_security_pin_edit_view'
                            savePinHandler={options?.savePinHandler}
                        />
                    ),
                    options: {
                        size: 'full',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                        // gorhom's BottomSheetView is top-anchored and
                        // content-sized, so the PIN layout can't flex-fill
                        // the sheet; use the plain flex container instead.
                        autoCreateContainer: false,
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
                    const result = await enableBiometrics({
                        title: t('security.biometric.enable_prompt_title'),
                        cancelLabel: t('security.biometric.cancel_label'),
                    })

                    if (!result.ok) {
                        // Targeted guidance per failure: a weak (class-2)
                        // biometric can't be bound (enroll a fingerprint); an
                        // 'unconfirmed' level is a temporary lockout the user
                        // clears with the device passcode; everything else is the
                        // generic "couldn't authenticate" error.
                        const toast =
                            result.reason === 'weak-biometric'
                                ? {
                                      title: t(
                                          'settings.security.biometric_weak_title',
                                      ),
                                      body: t(
                                          'settings.security.biometric_weak_message',
                                      ),
                                  }
                                : result.reason === 'unconfirmed'
                                  ? {
                                        title: t(
                                            'settings.security.biometric_unconfirmed_title',
                                        ),
                                        body: t(
                                            'settings.security.biometric_unconfirmed_message',
                                        ),
                                    }
                                  : {
                                        title: t(
                                            'settings.security.biometric_error_title',
                                        ),
                                        body: t(
                                            'settings.security.biometric_error_message',
                                        ),
                                    }
                        showToast({ ...toast, type: 'error' })
                    }
                    return result.ok
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

        const isRekeySupportEnabled = !!getPreference(
            UserPreferences.rekeySupportEnabled,
        )
        const isAssetFreezeSupportEnabled = !!getPreference(
            UserPreferences.assetFreezeSupportEnabled,
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

        const isShakeToLockEnabled = !!getPreference(
            UserPreferences.shakeToLockEnabled,
        )

        const handleShakeToLockToggle = useCallback(
            (value: boolean) => {
                setPreference(UserPreferences.shakeToLockEnabled, value)
            },
            [setPreference],
        )

        const duressSavePinHandler = useCallback(
            async (pin: string): Promise<SavePinHandlerResult> => {
                // Reject if the entered duress PIN matches the regular PIN —
                // letting them coincide would mean a normal unlock always
                // wipes data, which is catastrophic.
                const verifyResult = await verifyPin(pin)
                if (verifyResult.kind === 'ok') {
                    showToast({
                        title: t(
                            'settings.security.duress_pin_matches_regular',
                        ),
                        body: '',
                        type: 'error',
                    })
                    return { ok: false, reason: 'matches-regular-pin' }
                }
                // The keystore record is the only source of truth for whether
                // a duress PIN exists (read via checkDuressPinEnabled); don't
                // mirror it into a plaintext MMKV flag.
                await saveDuressPin(pin)
                setIsDuressPinEnabled(true)
                return { ok: true }
            },
            [verifyPin, saveDuressPin, showToast, t],
        )

        const handleDuressPinToggle = useCallback(
            async (value: boolean) => {
                if (value) {
                    const success = await openPinSheet('setup', {
                        savePinHandler: duressSavePinHandler,
                    })
                    if (!success) {
                        // User cancelled the setup sheet — revert any
                        // optimistic UI; nothing was written so just refresh.
                        refreshPinState()
                    }
                    return
                }
                // Disabling: gate on the regular PIN so an unlocked-app
                // attacker can't quietly remove the safety net.
                const verified = await openPinSheet('verify')
                if (!verified) {
                    refreshPinState()
                    return
                }
                await saveDuressPin(null)
                setIsDuressPinEnabled(false)
            },
            [
                openPinSheet,
                duressSavePinHandler,
                saveDuressPin,
                refreshPinState,
            ],
        )

        const isAdvancedSecurityEnabled =
            isRekeySupportEnabled ||
            isAssetFreezeSupportEnabled ||
            isShakeToLockFeatureEnabled ||
            isDuressPinFeatureEnabled

        return {
            isPinEnabled,
            isBiometricEnabled,
            isBiometricsAvailable,
            isAdvancedSecurityEnabled,
            isRekeySupportEnabled,
            isAssetFreezeSupportEnabled,
            isShakeToLockFeatureEnabled,
            isShakeToLockEnabled,
            isDuressPinFeatureEnabled,
            isDuressPinEnabled,
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
            handleRekeyToggle,
            handleAssetFreezeToggle,
            handleShakeToLockToggle,
            handleDuressPinToggle,
        }
    }
