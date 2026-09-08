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
import { createHash } from 'crypto'
import type {
    BiometricsAuthenticateFailureReason,
    BiometricsAuthenticatePrompt,
    BiometricType,
    BiometricUnwrapFailureReason,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useKMSService } from '@perawallet/wallet-core-kms'
import { bytesToHex, type Nullable } from '@perawallet/wallet-core-shared'
import {
    BIOMETRIC_BLOB_KEY_ID,
    BIOMETRIC_TOKEN_HASH_METADATA_KEY,
    PIN_RECORD_KEY_ID,
} from '../constants'
import { decodeBiometricBlob, encodeBiometricBlob } from '../biometricBlob'
import type { BiometricsDisabledReason } from '../models'
import { constantTimeEqual, parsePinRecord } from '../pinRecord'
import { useSecurityStore } from '../store'

/**
 * Why enabling biometrics failed, so callers can show targeted guidance
 * instead of a single generic error.
 *
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
 * - `declined` — the user dismissed or failed the confirmation ceremony.
 * - `error` — an unexpected failure.
 */
export type EnableBiometricsFailureReason =
    | 'unavailable'
    | 'weak-biometric'
    | 'unconfirmed'
    | 'declined'
    | 'error'

export type EnableBiometricsResult =
    | { ok: true }
    | { ok: false; reason: EnableBiometricsFailureReason }

export type BiometricUnlockOutcome =
    | { kind: 'ok' }
    | { kind: 'locked'; lockoutEndTime: number }
    | { kind: 'mismatch' }
    | { kind: 'failed'; reason: BiometricUnwrapFailureReason }

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
     * ("strong") biometric whose OS-bound key still backs the stored blob. It
     * deletes the blob on affirmative reports — a class-2 enrollment, or a
     * key-pair probe reporting `changed`/`absent` — and on nothing else: a
     * level or a probe result it cannot confirm reports false and keeps the
     * blob, so a returned false does NOT imply the blob is gone. Callers get
     * the post-reconciliation answer, consistent with a subsequent call.
     */
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    enableBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<EnableBiometricsResult>
    disableBiometrics: () => Promise<void>
    unlockWithBiometrics: (
        prompt?: BiometricsAuthenticatePrompt,
    ) => Promise<BiometricUnlockOutcome>
}

const sha256Hex = (bytes: Uint8Array): string =>
    bytesToHex(new Uint8Array(createHash('sha256').update(bytes).digest()))

// Compared over the encoded hex rather than the raw digests, because
// `constantTimeEqual` takes bytes and the stored hash arrives as a string.
const matchesHash = (token: Uint8Array, expected: string): boolean => {
    const encoder = new TextEncoder()
    return constantTimeEqual(
        encoder.encode(sha256Hex(token)),
        encoder.encode(expected),
    )
}

export const useBiometrics = (): UseBiometricsResult => {
    const biometricsService = getProvider().biometrics
    const {
        commitSecret,
        withSecret,
        hasSecret,
        removeSecret,
        getSecretMetadata,
    } = useKMSService()

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
            // state either check above can observe, so the key-pair probe is
            // the only signal for it. Only 'valid' arms unlock. Both 'changed'
            // and 'absent' are affirmative reports that the key is unusable,
            // and the blob is worthless without it — adopting a fresh binding
            // for 'absent' would leave a blob sealed under a key that no
            // longer exists, reporting enabled forever while every unlock
            // burned a real ceremony and then failed.
            const binding = await biometricsService.checkEnrollmentBinding()
            if (binding === 'changed') {
                await dropOptIn('enrollment-changed')
                return false
            }
            if (binding === 'absent') {
                await dropOptIn('rebind-required')
                return false
            }
            if (binding === 'unavailable') {
                // No reading could be taken. Ambiguity never destroys.
                setIsEnabled(false)
                return false
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
        async (blob: string, tokenHash: string): Promise<void> => {
            await commitSecret({
                id: BIOMETRIC_BLOB_KEY_ID,
                bytes: encodeBiometricBlob(blob),
                metadata: { [BIOMETRIC_TOKEN_HASH_METADATA_KEY]: tokenHash },
            })
        },
        [commitSecret],
    )

    const enableBiometrics = useCallback(
        async (
            prompt?: BiometricsAuthenticatePrompt,
        ): Promise<EnableBiometricsResult> => {
            try {
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

                const armed = await biometricsService.armBiometricBinding()
                if (!armed) return { ok: false, reason: 'error' }

                // `armBiometricBinding` is destructive-idempotent: it deletes
                // any existing key before minting the new one, so a blob
                // already in the keystore is sealed under a key that is now
                // gone the instant this line returns. Drop it here rather
                // than leaving it for a declined ceremony to orphan — an
                // 'unavailable' probe reading can otherwise flip the toggle
                // OFF while keeping a still-good blob, only for a re-enable
                // attempt the user cancels to destroy it for good.
                await removeSecret(BIOMETRIC_BLOB_KEY_ID)

                // The confirmation ceremony IS the unwrap. Proving the OS will
                // release the token is the only thing that proves unlock will
                // work later; a prompt that merely returns true proves
                // nothing, which is the defect this closes.
                const confirmed = await biometricsService.unwrapBiometricToken(
                    armed.blob,
                    prompt,
                )
                if (!confirmed.success) {
                    // No blob was written, and the reconcile's early return on
                    // a missing blob would never reach the binding — so it
                    // has to go now or it is orphaned for good.
                    await biometricsService.clearEnrollmentBinding()
                    return { ok: false, reason: 'declined' }
                }

                try {
                    if (!matchesHash(confirmed.token, armed.tokenHash)) {
                        await biometricsService.clearEnrollmentBinding()
                        return { ok: false, reason: 'error' }
                    }
                } finally {
                    confirmed.token.fill(0)
                }

                try {
                    await writeBiometricBlob(armed.blob, armed.tokenHash)
                } catch (err) {
                    // The key is armed but nothing backs it. Left alone, the
                    // reconcile's early return on a missing blob never
                    // reaches the binding, so it would report enabled
                    // forever while every unlock burned a real ceremony and
                    // then failed — the same hazard the decline path above
                    // guards against.
                    await biometricsService.clearEnrollmentBinding()
                    throw err
                }
                setIsEnabled(true)
                setDisabledReason(null)
                return { ok: true }
            } catch {
                return { ok: false, reason: 'error' }
            }
        },
        [
            biometricsService,
            removeSecret,
            writeBiometricBlob,
            setIsEnabled,
            setDisabledReason,
            dropOptIn,
        ],
    )

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

    const readLockoutEndTime = useCallback(async (): Promise<
        Nullable<number>
    > => {
        const record = await withSecret(PIN_RECORD_KEY_ID, parsePinRecord)
        const endTime = record?.lockoutEndTime ?? null
        return endTime !== null && endTime > Date.now() ? endTime : null
    }, [withSecret])

    const unlockWithBiometrics = useCallback(
        async (
            prompt?: BiometricsAuthenticatePrompt,
        ): Promise<BiometricUnlockOutcome> => {
            try {
                if (!(await checkBiometricsEnabled())) {
                    return { kind: 'failed', reason: 'unavailable' }
                }

                // The lock screen gates on the store-hydrated lockout flag,
                // which is still false during a cold start. The record is the
                // only authority, and biometrics must not outrank a PIN
                // lockout.
                const lockoutEndTime = await readLockoutEndTime()
                if (lockoutEndTime !== null) {
                    return { kind: 'locked', lockoutEndTime }
                }

                const expected = getSecretMetadata(BIOMETRIC_BLOB_KEY_ID)?.[
                    BIOMETRIC_TOKEN_HASH_METADATA_KEY
                ]
                // A blob this build cannot frame-check is a pre-binding blob,
                // and decodeBiometricBlob reports that as null rather than
                // letting it reach the enclave and come back as a decryption
                // error. Wrapped so a failed keystore *read* (withSecret
                // resolving null) is distinguishable from a read that came
                // back but didn't decode — only the latter is an affirmative
                // signal about the blob itself.
                const blobRead = await withSecret(
                    BIOMETRIC_BLOB_KEY_ID,
                    bytes => ({
                        decoded: decodeBiometricBlob(bytes),
                    }),
                )
                if (!blobRead) {
                    // hasSecret was true moments ago (checkBiometricsEnabled
                    // above), so a null here means the read itself failed —
                    // ambiguous, not affirmative. Must not destroy the opt-in.
                    return { kind: 'failed', reason: 'unavailable' }
                }
                if (!blobRead.decoded || typeof expected !== 'string') {
                    await dropOptIn('rebind-required')
                    return { kind: 'mismatch' }
                }
                const blob = blobRead.decoded

                const released = await biometricsService.unwrapBiometricToken(
                    blob,
                    prompt,
                )
                if (!released.success) {
                    // `invalidated` is the one unwrap reason that is
                    // affirmative rather than a prompt outcome: neither
                    // native module emits it for a decline, a cancel or a
                    // lockout, only for the OS having destroyed the key. It
                    // is exactly the signal that may destroy an opt-in.
                    if (released.reason === 'invalidated') {
                        await dropOptIn('enrollment-changed')
                        return { kind: 'mismatch' }
                    }
                    // Every other reason — declined, cancelled, locked-out —
                    // says nothing about the key, so the opt-in survives.
                    return { kind: 'failed', reason: released.reason }
                }

                try {
                    if (!matchesHash(released.token, expected)) {
                        // Only reachable through corruption: the token the OS
                        // released is not the one that was sealed.
                        await dropOptIn('rebind-required')
                        return { kind: 'mismatch' }
                    }
                } finally {
                    released.token.fill(0)
                }

                return { kind: 'ok' }
            } catch {
                return { kind: 'failed', reason: 'unknown' }
            }
        },
        [
            checkBiometricsEnabled,
            readLockoutEndTime,
            getSecretMetadata,
            withSecret,
            biometricsService,
            dropOptIn,
        ],
    )

    return {
        isEnabled,
        isAvailable,
        disabledReason,
        acknowledgeBiometricsDisabled,
        checkBiometricsEnabled,
        checkBiometricsAvailable,
        enableBiometrics,
        disableBiometrics,
        unlockWithBiometrics,
    }
}

export type { BiometricType, BiometricsAuthenticateFailureReason }
