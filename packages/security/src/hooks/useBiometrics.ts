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
import {
    type BiometricsAuthenticatePrompt,
    type BiometricType,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useKMSService } from '@perawallet/wallet-core-kms'
import { BIOMETRIC_BLOB_KEY_ID, PIN_RECORD_KEY_ID } from '../constants'

type UseBiometricsResult = {
    isEnabled: boolean
    isAvailable: boolean
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    refreshBiometricsBinding: () => Promise<void>
    enableBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<boolean>
    disableBiometrics: () => Promise<void>
    authenticateWithBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<boolean>
}

export const useBiometrics = (): UseBiometricsResult => {
    const biometricsService = getProvider().biometrics
    const { commitSecret, withSecret, hasSecret, removeSecret } =
        useKMSService()

    const [isEnabled, setIsEnabled] = useState(false)
    const [isAvailable, setIsAvailable] = useState(false)

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        return hasSecret(BIOMETRIC_BLOB_KEY_ID)
    }, [hasSecret])

    const checkBiometricsAvailable = useCallback(async (): Promise<boolean> => {
        return biometricsService.checkBiometricsAvailable()
    }, [biometricsService])

    useEffect(() => {
        checkBiometricsEnabled().then(setIsEnabled)
        checkBiometricsAvailable().then(setIsAvailable)
    }, [checkBiometricsEnabled, checkBiometricsAvailable])

    const writeBiometricBlob = useCallback(
        async (code: Uint8Array): Promise<void> => {
            // `commitSecret` takes a defensive copy of `code` and zeroes its
            // own copy after the keystore write completes. The caller still
            // owns `code` itself — callers in this file pass `pinData`
            // borrowed from `withSecret`, which zeroes it on return.
            await commitSecret({
                id: BIOMETRIC_BLOB_KEY_ID,
                bytes: code,
            })
            setIsEnabled(true)
        },
        [commitSecret],
    )

    const enableBiometrics = useCallback(
        async (prompt?: BiometricsAuthenticatePrompt): Promise<boolean> => {
            try {
                const result = await withSecret(
                    PIN_RECORD_KEY_ID,
                    async pinData => {
                        const available =
                            await biometricsService.checkBiometricsAvailable()
                        if (!available) return false

                        const authenticated =
                            await biometricsService.authenticate(prompt)
                        if (!authenticated) return false

                        // `writeBiometricBlob` copies the bytes into the keystore;
                        // the original `pinData` here is zeroed by
                        // `withSecret`'s finally after this resolves.
                        await writeBiometricBlob(pinData)
                        return true
                    },
                )
                return result ?? false
            } catch {
                return false
            }
        },
        [biometricsService, withSecret, writeBiometricBlob],
    )

    // Re-bind the biometric blob to the current PIN_RECORD bytes. Called by
    // `usePinCode.savePin` after a PIN change. No-op when biometrics aren't
    // already enabled; never re-prompts the OS biometric sheet (we already
    // have the user authenticated via PIN at the call site).
    const refreshBiometricsBinding = useCallback(async (): Promise<void> => {
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) return
        await withSecret(PIN_RECORD_KEY_ID, async pinData => {
            await writeBiometricBlob(pinData)
        })
    }, [hasSecret, withSecret, writeBiometricBlob])

    const disableBiometrics = useCallback(async () => {
        await removeSecret(BIOMETRIC_BLOB_KEY_ID)
        setIsEnabled(false)
    }, [removeSecret])

    const authenticateWithBiometrics = useCallback(
        async (prompt?: BiometricsAuthenticatePrompt): Promise<boolean> => {
            if (!(await checkBiometricsEnabled())) {
                return false
            }

            try {
                return await biometricsService.authenticate(prompt)
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
        refreshBiometricsBinding,
        enableBiometrics,
        disableBiometrics,
        authenticateWithBiometrics,
    }
}

export type { BiometricType }
