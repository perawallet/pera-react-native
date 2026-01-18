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

import { useCallback } from 'react'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useSecurityStore } from '../store'
import {
    PIN_STORAGE_KEY,
    BIOMETRIC_STORAGE_KEY,
    type BiometricType,
} from '../models'

type UseBiometricsResult = {
    isBiometricEnabled: boolean
    enableBiometrics: () => Promise<boolean>
    disableBiometrics: () => Promise<void>
    authenticateWithBiometrics: () => Promise<boolean>
}

export const useBiometrics = (): UseBiometricsResult => {
    const secureStorage = useSecureStorageService()
    const isBiometricEnabled = useSecurityStore(
        state => state.isBiometricEnabled,
    )
    const setIsBiometricEnabled = useSecurityStore(
        state => state.setIsBiometricEnabled,
    )
    const isPinEnabled = useSecurityStore(state => state.isPinEnabled)

    const enableBiometrics = useCallback(async (): Promise<boolean> => {
        if (!isPinEnabled) {
            return false
        }

        try {
            const pinData = await secureStorage.getItem(PIN_STORAGE_KEY)
            if (!pinData) {
                return false
            }

            await secureStorage.setItem(BIOMETRIC_STORAGE_KEY, pinData)
            setIsBiometricEnabled(true)
            return true
        } catch {
            return false
        }
    }, [isPinEnabled, secureStorage, setIsBiometricEnabled])

    const disableBiometrics = useCallback(async () => {
        await secureStorage.removeItem(BIOMETRIC_STORAGE_KEY)
        setIsBiometricEnabled(false)
    }, [secureStorage, setIsBiometricEnabled])

    const authenticateWithBiometrics =
        useCallback(async (): Promise<boolean> => {
            if (!isBiometricEnabled) {
                return false
            }

            try {
                const pinData = await secureStorage.getItem(PIN_STORAGE_KEY)
                const biometricPinData = await secureStorage.getItem(
                    BIOMETRIC_STORAGE_KEY,
                )

                if (!pinData || !biometricPinData) {
                    return false
                }

                const pin = new TextDecoder().decode(pinData)
                const biometricPin = new TextDecoder().decode(biometricPinData)

                return pin === biometricPin
            } catch {
                return false
            }
        }, [isBiometricEnabled, secureStorage])

    return {
        isBiometricEnabled,
        enableBiometrics,
        disableBiometrics,
        authenticateWithBiometrics,
    }
}

export type { BiometricType }
