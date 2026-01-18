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
    handlePinToggle: (value: boolean) => void
    handleBiometricToggle: (value: boolean) => Promise<boolean>
    handleChangePinPress: () => void
}

export const useSettingsSecurityScreen =
    (): UseSettingsSecurityScreenResult => {
        const navigation = useNavigation<SettingsSecurityNavigationProp>()
        const { isPinEnabled, deletePin } = usePinCode()
        const {
            isBiometricEnabled,
            isBiometricAvailable: checkBiometricAvailable,
            enableBiometrics,
            disableBiometrics,
        } = useBiometrics()

        const [isBiometricAvailable, setIsBiometricAvailable] = useState(false)

        useEffect(() => {
            checkBiometricAvailable().then(setIsBiometricAvailable)
        }, [checkBiometricAvailable])

        const handlePinToggle = useCallback(
            async (value: boolean) => {
                if (value) {
                    navigation.getParent()?.navigate('Security', {
                        screen: 'PinEntry',
                        params: { mode: 'setup' },
                    })
                } else {
                    await deletePin()
                }
            },
            [navigation, deletePin],
        )

        const handleBiometricToggle = useCallback(
            async (value: boolean): Promise<boolean> => {
                if (value) {
                    const success = await enableBiometrics()
                    return success
                } else {
                    await disableBiometrics()
                    return true
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

        return {
            isPinEnabled,
            isBiometricEnabled,
            isBiometricAvailable,
            handlePinToggle,
            handleBiometricToggle,
            handleChangePinPress,
        }
    }
