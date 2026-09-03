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
 * - `no-pin` — no PIN record to wrap; a PIN must be set first.
 * - `unavailable` — the device has no usable biometric hardware/enrollment.
 * - `weak-biometric` — a biometric is enrolled, but only at class-2 ("weak")
 * strength (e.g. Samsung 2D face unlock). Wallet unlock
 * requires a hardware-backed class-3 ("strong")
 * authenticator, so the user must enroll a fingerprint or
 * other strong biometric. Android-only in practice.
 * - `unconfirmed` — a biometric is enrolled but the device reports a
 * non-strong level we can't bind to right now, without it
 * being a weak enrollment: iOS reports enrolled-but-'secret'
 * during a Face ID lockout the user clears with the device
 * passcode, not from inside the app. The opt-in is left
 * intact so unlock auto-restores once the level does.
 * - `declined` — the user dismissed or failed the OS prompt.
 * - `error` — an unexpected failure.
 */
export type EnableBiometricsFailureReason =
    | 'no-pin'
    | 'unavailable'
    | 'weak-biometric'
    | 'unconfirmed'
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
     * opt-in. It deletes the blob on the two affirmative reports — a class-2
     * enrollment, or a changed enrollment set — and on nothing else: a level or
     * an availability it cannot confirm reports false and keeps the blob, so a
     * returned false does NOT imply the blob is gone. Callers get the
     * post-reconciliation answer, consistent with a subsequent call.
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
    // showing ON. Granular selectors, per the store conventions.
    const isEnabled = useSecurityStore(state => state.isBiometricsEnabled)
    const setIsEnabled = useSecurityStore(state => state.setBiometricsEnabled)
    const disabledReason = useSecurityStore(
        state => state.biometricsDisabledReason,
    )
    const setDisabledReason = useSecurityStore(
        state => state.setBiometricsDisabledReason,
    )
    const acknowledgedReason = useSecurityStore(
        state => state.acknowledgedBiometricsDisabledReason,
    )
    const setAcknowledgedReason = useSecurityStore(
        state => state.setAcknowledgedBiometricsDisabledReason,
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
            // A fresh drop is its own event: an earlier decline must not
            // swallow the offer for this one.
            setAcknowledgedReason(null)
        },
        [
            removeSecret,
            biometricsService,
            setIsEnabled,
            setDisabledReason,
            setAcknowledgedReason,
        ],
    )

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) {
            setIsEnabled(false)
            return false
        }

        // Reports disabled without destroying anything. Underneath, Android's
        // `isEnrolledAsync` is `canAuthenticate(BIOMETRIC_WEAK) == SUCCESS`, so
        // this predicate folds NONE_ENROLLED together with HW_UNAVAILABLE
        // (sensor busy, or locked out after too many failed attempts),
        // SECURITY_UPDATE_REQUIRED and STATUS_UNKNOWN — and expo exposes no way
        // to tell them apart. Deleting the blob here meant a lockout, which
        // clears itself, permanently cost the user their opt-in.
        //
        // Keeping it is safe because the enrollment binding below is the
        // affirmative signal for the case this branch used to cover: a blob kept
        // through "every biometric removed" is dropped as soon as a new one is
        // enrolled, which is the only way it could have re-armed unlock.
        if (!(await biometricsService.checkBiometricsAvailable())) {
            setIsEnabled(false)
            // Whether to say anything is a different question from whether to
            // destroy anything, and only `getAvailability` can answer it: a
            // lockout clears itself and must stay silent, while an empty
            // enrollment or a revoked app permission persists until the user
            // acts, and biometric unlock quietly not working is exactly what
            // this is meant to prevent.
            const availability = await biometricsService.getAvailability()
            const isPersistent =
                availability === 'none-enrolled' || availability === 'denied'
            // Re-derived from live device state on every reconcile, unlike the
            // event-driven reasons — so a decline has to be remembered here or
            // the offer would come back on the very next unlock, and every one
            // after it, until the user gave in.
            if (isPersistent && acknowledgedReason !== 'not-available') {
                setDisabledReason('not-available')
            }
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
            // Biometric unlock works, so there is nothing left to explain. This
            // matters now that `not-available` is recorded without destroying
            // the blob: the user who grants a revoked permission back recovers
            // here silently, and a stale reason would put a screen in front of
            // them offering to fix what they just fixed. Every other reason
            // implies a destroyed blob, which never reaches this line.
            setDisabledReason(null)
            // Resolved, so a later recurrence is a new event and deserves the
            // offer again even if this one was declined.
            setAcknowledgedReason(null)
            return true
        }

        // Something is enrolled but cannot be bound by `enableBiometrics` or
        // pass the Android prompt's `strong` bar, so report disabled. Only an
        // affirmative class-2 report may also destroy the opt-in (
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
    }, [
        hasSecret,
        dropOptIn,
        biometricsService,
        setIsEnabled,
        setDisabledReason,
        acknowledgedReason,
        setAcknowledgedReason,
    ])

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
                        // ("strong") authenticator. Anything below that fails
                        // fast, before popping a doomed OS prompt — but the two
                        // non-strong cases must be handled apart, exactly as the
                        // reconcile's own branches do.
                        const level = await biometricsService.getSecurityLevel()
                        if (level === 'weak') {
                            // A class-2 ("weak") modality — e.g. Samsung 2D face
                            // unlock — must not be bound. Drop the opt-in for it,
                            // just as the reconcile's `weak` branch does: with
                            // `isEnabled` false the Settings toggle reads OFF, so
                            // its own delete branch is unreachable and this is the
                            // only user-driven moment where dropping it is
                            // unambiguously safe. The reason is recorded, not
                            // cleared, so the UI can guide the user to enroll a
                            // fingerprint.
                            await dropOptIn('weak-biometric')
                            return { ok: false, reason: 'weak-biometric' }
                        }
                        if (level !== 'strong') {
                            // 'secret' / 'none': a biometric is enrolled but the
                            // level is ambiguous — iOS reports enrolled-but-
                            // 'secret' during a Face ID lockout the user can only
                            // clear with the device passcode. Preserve the opt-in
                            // (the reconcile's secret/none branch does the same):
                            // dropping it here would turn a self-clearing lockout
                            // into a permanent opt-out.
                            return { ok: false, reason: 'unconfirmed' }
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
        if (disabledReason) setAcknowledgedReason(disabledReason)
        setDisabledReason(null)
    }, [disabledReason, setAcknowledgedReason, setDisabledReason])

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
