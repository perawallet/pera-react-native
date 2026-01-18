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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import type { SettingsStackParamsList } from '@modules/settings/routes'

type SettingsSecurityNavigationProp = NativeStackNavigationProp<
    SettingsStackParamsList,
    'SecuritySettings'
>

type UseSettingsSecurityScreenResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    isBiometricAvailable: boolean
    showDeletePinDialog: boolean
    handlePinToggle: (value: boolean) => void
    handleBiometricToggle: (value: boolean) => void
    handleChangePinPress: () => void
    handleDeletePinConfirm: () => void
    handleDeletePinCancel: () => void
}

export const useSettingsSecurityScreen =
    (): UseSettingsSecurityScreenResult => {
        const navigation = useNavigation<SettingsSecurityNavigationProp>()
        const { isPinEnabled, deletePin } = usePinCode()
        const { isBiometricEnabled, enableBiometrics, disableBiometrics } =
            useBiometrics()

        const [showDeletePinDialog, setShowDeletePinDialog] = useState(false)

        const isBiometricAvailable = true

        const handlePinToggle = useCallback(
            (value: boolean) => {
                if (value) {
                    navigation.getParent()?.navigate('Security', {
                        screen: 'PinEntry',
                        params: { mode: 'setup' },
                    })
                } else {
                    setShowDeletePinDialog(true)
                }
            },
            [navigation],
        )

        const handleBiometricToggle = useCallback(
            async (value: boolean) => {
                if (value) {
                    await enableBiometrics()
                } else {
                    await disableBiometrics()
                }
            },
            [enableBiometrics, disableBiometrics],
        )

        const handleChangePinPress = useCallback(() => {
            navigation.getParent()?.navigate('Security', {
                screen: 'PinEntry',
                params: { mode: 'change_old' },
            })
        }, [navigation])

        const handleDeletePinConfirm = useCallback(async () => {
            await deletePin()
            setShowDeletePinDialog(false)
        }, [deletePin])

        const handleDeletePinCancel = useCallback(() => {
            setShowDeletePinDialog(false)
        }, [])

        return {
            isPinEnabled,
            isBiometricEnabled,
            isBiometricAvailable,
            showDeletePinDialog,
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
            handleDeletePinConfirm,
            handleDeletePinCancel,
        }
    }
