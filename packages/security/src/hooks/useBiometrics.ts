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

import { useCallback, useRef } from 'react'
import {
    useSecureStorageService,
    useBiometricsService,
} from '@perawallet/wallet-core-platform-integration'
import { type BiometricType } from '../models'
import { BIOMETRIC_STORAGE_KEY, PIN_STORAGE_KEY } from '../constants'

type UseBiometricsResult = {
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    setBiometricsCode: (code: Uint8Array) => Promise<void>
    enableBiometrics: () => Promise<boolean>
    disableBiometrics: () => Promise<void>
    authenticateWithBiometrics: () => Promise<boolean>
}

export const useBiometrics = (): UseBiometricsResult => {
    const forceRefresh = useRef(0)
    const secureStorage = useSecureStorageService()
    const biometricsService = useBiometricsService()

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        const biometricPinData = await secureStorage.getItem(
            BIOMETRIC_STORAGE_KEY,
        )
        return !!biometricPinData
    }, [secureStorage, forceRefresh.current])

    const checkBiometricsAvailable = useCallback(async (): Promise<boolean> => {
        return biometricsService.checkBiometricsAvailable()
    }, [biometricsService, forceRefresh.current])

    const setBiometricsCode = useCallback(
        async (code: Uint8Array): Promise<void> => {
            await secureStorage.setItem(BIOMETRIC_STORAGE_KEY, code)
            forceRefresh.current += 1
        },
        [secureStorage, forceRefresh.current],
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
        forceRefresh.current += 1
    }, [secureStorage, forceRefresh.current])

    const authenticateWithBiometrics = useCallback(
        async (
            promptTitle?: string,
            promptDescription?: string,
        ): Promise<boolean> => {
            if (!(await checkBiometricsEnabled())) {
                return false
            }

            try {
                const authenticated = await biometricsService.authenticate(
                    promptTitle,
                    promptDescription,
                )
                if (!authenticated) {
                    return false
                }

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
        },
        [checkBiometricsEnabled, biometricsService, secureStorage],
    )

    return {
        checkBiometricsEnabled,
        checkBiometricsAvailable,
        setBiometricsCode,
        enableBiometrics,
        disableBiometrics,
        authenticateWithBiometrics,
    }
}

export type { BiometricType }
