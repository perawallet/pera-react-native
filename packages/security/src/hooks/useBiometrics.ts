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
import { type BiometricType } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { BIOMETRIC_STORAGE_KEY, PIN_STORAGE_KEY } from '../constants'

type UseBiometricsResult = {
    isEnabled: boolean
    isAvailable: boolean
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    setBiometricsCode: (code: Uint8Array) => Promise<void>
    enableBiometrics: () => Promise<boolean>
    disableBiometrics: () => Promise<void>
    authenticateWithBiometrics: () => Promise<boolean>
}

export const useBiometrics = (): UseBiometricsResult => {
    const secureStorage = getProvider().secureStorage
    const biometricsService = getProvider().biometrics

    const [isEnabled, setIsEnabled] = useState(false)
    const [isAvailable, setIsAvailable] = useState(false)

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        const biometricPinData = await secureStorage.getItem(
            BIOMETRIC_STORAGE_KEY,
        )
        return !!biometricPinData
    }, [secureStorage])

    const checkBiometricsAvailable = useCallback(async (): Promise<boolean> => {
        return biometricsService.checkBiometricsAvailable()
    }, [biometricsService])

    useEffect(() => {
        checkBiometricsEnabled().then(setIsEnabled)
        checkBiometricsAvailable().then(setIsAvailable)
    }, [checkBiometricsEnabled, checkBiometricsAvailable])

    const setBiometricsCode = useCallback(
        async (code: Uint8Array): Promise<void> => {
            await secureStorage.setItem(BIOMETRIC_STORAGE_KEY, code)
            setIsEnabled(true)
        },
        [secureStorage],
    )

    const enableBiometrics = useCallback(
        async (
            promptTitle?: string,
            promptDescription?: string,
        ): Promise<boolean> => {
            const pinData = await secureStorage.getItem(PIN_STORAGE_KEY)
            if (!pinData) {
                return false
            }

            try {
                const available =
                    await biometricsService.checkBiometricsAvailable()
                if (!available) {
                    return false
                }

                const authenticated = await biometricsService.authenticate(
                    promptTitle,
                    promptDescription,
                )
                if (!authenticated) {
                    return false
                }

                await setBiometricsCode(pinData)
                return true
            } catch {
                return false
            }
        },
        [biometricsService, setBiometricsCode],
    )

    const disableBiometrics = useCallback(async () => {
        await secureStorage.removeItem(BIOMETRIC_STORAGE_KEY)
        setIsEnabled(false)
    }, [secureStorage])

    const authenticateWithBiometrics = useCallback(
        async (
            promptTitle?: string,
            promptDescription?: string,
        ): Promise<boolean> => {
            if (!(await checkBiometricsEnabled())) {
                return false
            }

            try {
                return await biometricsService.authenticate(
                    promptTitle,
                    promptDescription,
                )
            } catch {
                return false
            }
        },
        [checkBiometricsEnabled, biometricsService],
    )

    return {
        isEnabled,
        isAvailable,
        checkBiometricsEnabled,
        checkBiometricsAvailable,
        setBiometricsCode,
        enableBiometrics,
        disableBiometrics,
        authenticateWithBiometrics,
    }
}

export type { BiometricType }
