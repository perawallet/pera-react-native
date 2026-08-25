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
import { type Nullable } from '@perawallet/wallet-core-shared'
import { BIOMETRIC_BLOB_KEY_ID, PIN_RECORD_KEY_ID } from '../constants'
import { type BiometricsDisabledReason } from '../models'
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
     * Set only when the app turned biometrics off on the user's behalf, so the
     * UI can offer it back. Survives a restart; cleared by re-enabling or by
     * {@link acknowledgeBiometricsDisabled}.
     */
    disabledReason: Nullable<BiometricsDisabledReason>
    acknowledgeBiometricsDisabled: () => void
    /**
     * Reconciles, so NOT a pure read. Returns true only for an enrolled class-3
     * ("strong") biometric that still matches the enrollment binding recorded at
     * opt-in. It deletes the blob on an affirmative class-2 report, on an
     * affirmative "the enrolled set changed" report, and — coarsely, see the
     * branch itself — whenever no biometric appears available at all. A returned
     * false therefore does NOT imply the blob is gone: an unconfirmable level
     * reports false and keeps it. Callers get the post-reconciliation answer,
     * consistent with a subsequent call.
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
    const disabledReason = useSecurityStore(
        state => state.biometricsDisabledReason,
    )
    const setDisabledReason = useSecurityStore(
        state => state.setBiometricsDisabledReason,
    )
    const [isAvailable, setIsAvailable] = useState(false)

    // The blob and its enrollment binding are two halves of one opt-in and
    // always die together. A binding outliving its blob leaves a stale keystore
    // key; a blob outliving its binding re-arms unlock, because the next
    // reconcile sees no binding and adopts whatever is enrolled by then.
    //
    // `reason` is what separates the two callers: null is the user disabling
    // biometrics themselves, anything else is the app doing it for them and
    // owing them an explanation.
    const dropOptIn = useCallback(
        async (reason: Nullable<BiometricsDisabledReason>): Promise<void> => {
            await removeSecret(BIOMETRIC_BLOB_KEY_ID)
            await biometricsService.clearEnrollmentBinding()
            setIsEnabled(false)
            setDisabledReason(reason)
        },
        [removeSecret, biometricsService, setIsEnabled, setDisabledReason],
    )

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
        // Coarser than the class check below, and not a positive signal:
        // `checkBiometricsAvailable` folds "no hardware" and Android's
        // transient HW_UNAVAILABLE in with "none enrolled". Pre-existing.
        if (!(await biometricsService.checkBiometricsAvailable())) {
            await dropOptIn('enrollment-changed')
            return false
        }

        const level = await biometricsService.getSecurityLevel()
        if (level === 'strong') {
            // An enrolled strong biometric is not proof it is the *same* one
            // the user opted in with. Remove-then-re-add never passes through a
            // state either check above can observe, so the enrollment binding
            // is the only signal for it. Only an affirmative 'changed' may
            // destroy the opt-in; 'absent' is every install that opted in
            // before bindings existed (and everything arriving through the
            // legacy migration), so adopt the current set instead of forcing a
            // re-opt-in on upgrade.
            const binding = await biometricsService.checkEnrollmentBinding()
            if (binding === 'changed') {
                await dropOptIn('enrollment-changed')
                return false
            }
            if (binding === 'absent') {
                await biometricsService.createEnrollmentBinding()
            }
            setIsEnabled(true)
            return true
        }

        // Something is enrolled but cannot be bound by `enableBiometrics` or
        // pass the Android prompt's `strong` bar, so report disabled. Only an
        // affirmative class-2 report may also destroy the opt-in (PERA-4702:
        // removing every fingerprint where weak 2D face remains used to keep
        // the blob armed). 'secret' and 'none' are ambiguous — iOS reports
        // enrolled-but-'secret' during a Face ID lockout the user cannot clear
        // from inside the app.
        if (level === 'weak') {
            await dropOptIn('weak-biometric')
            return false
        }
        setIsEnabled(false)
        return false
    }, [hasSecret, dropOptIn, biometricsService, setIsEnabled])

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
        },
        [commitSecret],
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
                            // Clear any blob the reconcile kept for an
                            // unconfirmable level. With `isEnabled` false the
                            // Settings toggle reads OFF, so its delete branch
                            // is unreachable and this is the only user-driven
                            // moment where dropping it is unambiguously safe.
                            //
                            // No reason recorded: the caller is already showing
                            // the weak-biometric copy, so queuing a sheet that
                            // says the same thing later would just nag.
                            await dropOptIn(null)
                            return { ok: false, reason: 'weak-biometric' }
                        }

                        const authenticated =
                            await biometricsService.authenticate(prompt)
                        if (!authenticated.success) {
                            return { ok: false, reason: 'declined' }
                        }

                        // Before the blob, so the blob is never armed without a
                        // binding: that combination is the one the reconcile
                        // adopts, which would bless a set the user never
                        // approved.
                        await biometricsService.createEnrollmentBinding()

                        // `writeBiometricBlob` copies the bytes into the keystore;
                        // the original `pinData` here is zeroed by
                        // `withSecret`'s finally after this resolves.
                        await writeBiometricBlob(pinData)
                        setIsEnabled(true)
                        setDisabledReason(null)
                        return { ok: true }
                    },
                )
                // `withSecret` resolves null when no PIN record exists to wrap.
                return result ?? { ok: false, reason: 'no-pin' }
            } catch {
                return { ok: false, reason: 'error' }
            }
        },
        [
            biometricsService,
            withSecret,
            writeBiometricBlob,
            setIsEnabled,
            setDisabledReason,
            dropOptIn,
        ],
    )

    // Re-bind the biometric blob to the current PIN_RECORD bytes. Called by
    // `usePinCode.savePin` after a PIN change. No-op when biometrics aren't
    // already enabled; never re-prompts the OS biometric sheet (we already
    // have the user authenticated via PIN at the call site).
    const refreshBiometricsBinding = useCallback(async (): Promise<void> => {
        // Reconcile first so a blob whose enrollment is gone is dropped and the
        // guard below cannot re-arm it. Keyed on the blob surviving rather than
        // on the return value: the reconcile also returns false while
        // deliberately keeping a blob it could not confirm, and that one still
        // has to be re-bound or it would outlive the PIN it mirrors. The
        // reconcile owns `isEnabled`, so re-binding must not raise it.
        await checkBiometricsEnabled()
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) return
        await withSecret(PIN_RECORD_KEY_ID, async pinData => {
            await writeBiometricBlob(pinData)
        })
    }, [checkBiometricsEnabled, hasSecret, withSecret, writeBiometricBlob])

    // The reconcile's drop, minus the explanation: the user did this on
    // purpose, so there is nothing to offer them back.
    const disableBiometrics = useCallback(async (): Promise<void> => {
        await dropOptIn(null)
    }, [dropOptIn])

    // Dismissing the offer, without acting on it. Separate from re-enabling so
    // a decline is remembered — the prompt is shown once per drop, not on every
    // unlock until the user gives in.
    const acknowledgeBiometricsDisabled = useCallback((): void => {
        setDisabledReason(null)
    }, [setDisabledReason])

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
        disabledReason,
        acknowledgeBiometricsDisabled,
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
