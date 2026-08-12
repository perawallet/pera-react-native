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
import {
    type BiometricsAuthenticateFailureReason,
    type BiometricsAuthenticatePrompt,
    type BiometricsAuthenticateResult,
    type BiometricType,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useKMSService } from '@perawallet/wallet-core-kms'
import { BIOMETRIC_BLOB_KEY_ID, PIN_RECORD_KEY_ID } from '../constants'
import { useSecurityStore } from '../store'

/**
 * Why enabling biometrics failed, so callers can show targeted guidance
 * instead of a single generic error.
 *
 * - `no-pin`         — no PIN record to wrap; a PIN must be set first.
 * - `unavailable`    — the device has no usable biometric hardware/enrollment.
 * - `weak-biometric` — a biometric is enrolled, but only at class-2 ("weak")
 *                      strength (e.g. Samsung 2D face unlock). Wallet unlock
 *                      requires a hardware-backed class-3 ("strong")
 *                      authenticator, so the user must enroll a fingerprint or
 *                      other strong biometric.
 * - `declined`       — the user dismissed or failed the OS prompt.
 * - `error`          — an unexpected failure.
 */
export type EnableBiometricsFailureReason =
    | 'no-pin'
    | 'unavailable'
    | 'weak-biometric'
    | 'declined'
    | 'error'

export type EnableBiometricsResult =
    | { ok: true }
    | { ok: false; reason: EnableBiometricsFailureReason }

type UseBiometricsResult = {
    isEnabled: boolean
    isAvailable: boolean
    /**
     * Reconciles, so NOT a pure read: when the blob exists but the OS reports no
     * enrolled biometric, it deletes the blob and returns false. Callers get the
     * post-reconciliation answer, and a subsequent call is consistent with it.
     */
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    refreshBiometricsBinding: () => Promise<void>
    enableBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<EnableBiometricsResult>
    disableBiometrics: () => Promise<void>
    authenticateWithBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<BiometricsAuthenticateResult>
}

export const useBiometrics = (): UseBiometricsResult => {
    const biometricsService = getProvider().biometrics
    const { commitSecret, withSecret, hasSecret, removeSecret } =
        useKMSService()

    // Shared, not per-hook: Settings, the lock screen and PIN edit all mount
    // their own useBiometrics, and a reconcile that cleared a revoked blob used
    // to update only the calling screen's copy — leaving the Settings toggle
    // showing ON (PERA-4702). Granular selectors, per the store conventions.
    const isEnabled = useSecurityStore(state => state.isBiometricsEnabled)
    const setIsEnabled = useSecurityStore(state => state.setBiometricsEnabled)
    const [isAvailable, setIsAvailable] = useState(false)

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) {
            setIsEnabled(false)
            return false
        }

        // Fail closed on OS-level revocation. The blob is the app's only record
        // that biometric unlock was opted into, so one that outlives its
        // enrollment would silently re-arm unlock the moment the user enrolls a
        // new biometric — a fingerprint added after the fact could open the
        // wallet without the in-app toggle ever being touched. Drop the blob
        // instead and require an explicit re-enable. The PIN record is a
        // separate secret, so this never costs the user access.
        //
        // The signal is `isEnrolledAsync` underneath, i.e. a positive "no
        // biometric is enrolled" — not an auth failure. A biometric that is
        // merely locked out after too many attempts reports through
        // `authenticate`, not here, so a lockout does not drop the blob.
        if (await biometricsService.checkBiometricsAvailable()) {
            setIsEnabled(true)
            return true
        }

        await removeSecret(BIOMETRIC_BLOB_KEY_ID)
        setIsEnabled(false)
        return false
    }, [hasSecret, removeSecret, biometricsService, setIsEnabled])

    const checkBiometricsAvailable = useCallback(async (): Promise<boolean> => {
        return biometricsService.checkBiometricsAvailable()
    }, [biometricsService])

    useEffect(() => {
        void checkBiometricsEnabled()
        void checkBiometricsAvailable().then(setIsAvailable)
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
        [commitSecret, setIsEnabled],
    )

    const enableBiometrics = useCallback(
        async (
            prompt?: BiometricsAuthenticatePrompt,
        ): Promise<EnableBiometricsResult> => {
            try {
                const result = await withSecret(
                    PIN_RECORD_KEY_ID,
                    async (pinData): Promise<EnableBiometricsResult> => {
                        const available =
                            await biometricsService.checkBiometricsAvailable()
                        if (!available) {
                            return { ok: false, reason: 'unavailable' }
                        }

                        // Only bind biometrics to a hardware-backed class-3
                        // ("strong") authenticator. A class-2 ("weak") modality
                        // — e.g. Samsung 2D face unlock — must not be bound;
                        // fail fast with a distinct reason (before popping a
                        // doomed OS prompt) so the UI can tell the user to
                        // enroll a fingerprint.
                        const level = await biometricsService.getSecurityLevel()
                        if (level !== 'strong') {
                            return { ok: false, reason: 'weak-biometric' }
                        }

                        const authenticated =
                            await biometricsService.authenticate(prompt)
                        if (!authenticated.success) {
                            return { ok: false, reason: 'declined' }
                        }

                        // `writeBiometricBlob` copies the bytes into the keystore;
                        // the original `pinData` here is zeroed by
                        // `withSecret`'s finally after this resolves.
                        await writeBiometricBlob(pinData)
                        return { ok: true }
                    },
                )
                // `withSecret` resolves null when no PIN record exists to wrap.
                return result ?? { ok: false, reason: 'no-pin' }
            } catch {
                return { ok: false, reason: 'error' }
            }
        },
        [biometricsService, withSecret, writeBiometricBlob],
    )

    // Re-bind the biometric blob to the current PIN_RECORD bytes. Called by
    // `usePinCode.savePin` after a PIN change. No-op when biometrics aren't
    // already enabled; never re-prompts the OS biometric sheet (we already
    // have the user authenticated via PIN at the call site).
    const refreshBiometricsBinding = useCallback(async (): Promise<void> => {
        // Goes through the reconciling check, not a bare `hasSecret`, so a PIN
        // change cannot re-write a blob whose OS enrollment is already gone.
        if (!(await checkBiometricsEnabled())) return
        await withSecret(PIN_RECORD_KEY_ID, async pinData => {
            await writeBiometricBlob(pinData)
        })
    }, [checkBiometricsEnabled, withSecret, writeBiometricBlob])

    const disableBiometrics = useCallback(async () => {
        await removeSecret(BIOMETRIC_BLOB_KEY_ID)
        setIsEnabled(false)
    }, [removeSecret, setIsEnabled])

    const authenticateWithBiometrics = useCallback(
        async (
            prompt?: BiometricsAuthenticatePrompt,
        ): Promise<BiometricsAuthenticateResult> => {
            try {
                if (!(await checkBiometricsEnabled())) {
                    return { success: false, reason: 'unavailable' }
                }
                return await biometricsService.authenticate(prompt)
            } catch {
                // The reconcile above reaches the keystore, so guard it here
                // rather than letting callers catch.
                return { success: false, reason: 'unknown' }
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

export type {
    BiometricType,
    BiometricsAuthenticateFailureReason,
    BiometricsAuthenticateResult,
}
