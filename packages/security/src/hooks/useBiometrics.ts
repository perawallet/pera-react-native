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
    LEGACY_BIOMETRIC_BLOB_KEY_ID,
    MAX_BIOMETRIC_UNWRAP_FAILURES,
    PIN_RECORD_KEY_ID,
} from '../constants'
import { decodeBiometricBlob, encodeBiometricBlob } from '../biometricBlob'
import type { BiometricsDisabledReason } from '../models'
import { constantTimeEqual, parsePinRecord } from '../pinRecord'
import { useSecurityStore } from '../store'

/**
 * - `weak-biometric` — only a class-2 biometric (e.g. 2D face unlock) is
 *   enrolled and unlock needs class-3. The opt-in is dropped.
 * - `unconfirmed` — enrolled, but the level cannot be confirmed right now:
 *   iOS reports 'secret' during a Face ID lockout. The opt-in is kept.
 * - `declined` — the user dismissed or failed the confirmation ceremony.
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
    /** Set only when the app turned biometrics off on the user's behalf. */
    disabledReason: Nullable<BiometricsDisabledReason>
    acknowledgeBiometricsDisabled: () => void
    /**
     * Reconciles, so not a pure read: it drops the opt-in on affirmative
     * reports (a class-2 enrollment, a probe reading `changed` or `absent`)
     * and on nothing else, so a returned false does not imply the blob is gone.
     */
    checkBiometricsEnabled: () => Promise<boolean>
    checkBiometricsAvailable: () => Promise<boolean>
    enableBiometrics: (
        prompt: BiometricsAuthenticatePrompt,
    ) => Promise<EnableBiometricsResult>
    disableBiometrics: () => Promise<void>
    unlockWithBiometrics: (
        prompt: BiometricsAuthenticatePrompt,
    ) => Promise<BiometricUnlockOutcome>
}

const sha256Hex = (bytes: Uint8Array): string =>
    bytesToHex(new Uint8Array(createHash('sha256').update(bytes).digest()))

// Compared as encoded hex because `constantTimeEqual` takes bytes and the
// stored hash is a string.
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

    // Store-backed so Settings, the lock screen and PIN edit agree after a
    // reconcile run by any one of them.
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
    const setUnwrapFailures = useSecurityStore(
        state => state.setBiometricUnwrapFailures,
    )
    const [isAvailable, setIsAvailable] = useState(false)

    // The blob and its OS-bound key die together. `reason` is null when the
    // user disabled biometrics themselves; anything else is the app doing it
    // for them and owing an explanation.
    const dropOptIn = useCallback(
        async (reason: Nullable<BiometricsDisabledReason>): Promise<void> => {
            await removeSecret(BIOMETRIC_BLOB_KEY_ID)
            await removeSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID)
            await biometricsService.clearEnrollmentBinding()
            setIsEnabled(false)
            setDisabledReason(reason)
            // A fresh drop is a new event; an earlier decline must not swallow
            // its offer.
            setAcknowledgedReason(null)
            setUnwrapFailures(0)
        },
        [
            removeSecret,
            biometricsService,
            setIsEnabled,
            setDisabledReason,
            setAcknowledgedReason,
            setUnwrapFailures,
        ],
    )

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        // A blob from before OS-bound keys existed: nothing can unwrap it, so
        // it is swept without a probe and the user is asked to opt in again.
        if (hasSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID)) {
            await dropOptIn('rebind-required')
            return false
        }
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) {
            setIsEnabled(false)
            return false
        }

        // Android folds a self-clearing lockout in with "nothing enrolled"
        // here, so this branch may report disabled but never destroy.
        if (!(await biometricsService.checkBiometricsAvailable())) {
            setIsEnabled(false)
            // Only a persistent cause is worth explaining, and a decline has to
            // be remembered here because this is re-derived on every reconcile.
            const availability = await biometricsService.getAvailability()
            const isPersistent =
                availability === 'none-enrolled' || availability === 'denied'
            if (isPersistent && acknowledgedReason !== 'not-available') {
                setDisabledReason('not-available')
            }
            return false
        }

        const level = await biometricsService.getSecurityLevel()
        if (level === 'strong') {
            // Remove-then-re-add of a fingerprint never passes through a state
            // the checks above can see; only the key-pair probe catches it.
            // `absent` is not adopted: a blob sealed under a key that is gone
            // would report enabled forever while every unlock failed.
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
                setIsEnabled(false)
                return false
            }
            setIsEnabled(true)
            // Working again, so a standing explanation (a revoked permission
            // granted back) would offer to fix what the user just fixed.
            setDisabledReason(null)
            setAcknowledgedReason(null)
            return true
        }

        // Only an affirmative class-2 report destroys; 'secret' and 'none' are
        // ambiguous, as iOS reports 'secret' during a Face ID lockout.
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
            prompt: BiometricsAuthenticatePrompt,
        ): Promise<EnableBiometricsResult> => {
            try {
                const available =
                    await biometricsService.checkBiometricsAvailable()
                if (!available) {
                    return { ok: false, reason: 'unavailable' }
                }

                const level = await biometricsService.getSecurityLevel()
                if (level === 'weak') {
                    // The reconcile's own branch; with the toggle reading OFF
                    // this is the only user-driven moment where dropping is
                    // unambiguous.
                    await dropOptIn('weak-biometric')
                    return { ok: false, reason: 'weak-biometric' }
                }
                // 'secret' / 'none' are ambiguous (iOS Face ID lockout), so the
                // opt-in is kept.
                if (level !== 'strong') {
                    return { ok: false, reason: 'unconfirmed' }
                }

                const armed = await biometricsService.armBiometricBinding()
                if (!armed) return { ok: false, reason: 'error' }

                // Arming destroyed any previous key, so a blob still in the
                // keystore is sealed under a key that is gone; drop it before
                // a declined ceremony can orphan it.
                await removeSecret(BIOMETRIC_BLOB_KEY_ID)

                // The confirmation ceremony is the unwrap: proving the OS will
                // release the token is what proves unlock will work later.
                const confirmed = await biometricsService.unwrapBiometricToken(
                    armed.blob,
                    prompt,
                )
                if (!confirmed.success) {
                    // No blob backs the key, and the reconcile never reaches a
                    // binding without a blob, so it has to go now.
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
                    // Same orphan hazard as the decline above.
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

    const disableBiometrics = useCallback(async (): Promise<void> => {
        await dropOptIn(null)
    }, [dropOptIn])

    // Remembered per drop, so the offer is shown once rather than on every
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
            prompt: BiometricsAuthenticatePrompt,
        ): Promise<BiometricUnlockOutcome> => {
            try {
                if (!(await checkBiometricsEnabled())) {
                    return { kind: 'failed', reason: 'unavailable' }
                }

                // The store's lockout flag is not hydrated yet on a cold start;
                // the record is the authority, and biometrics must not outrank
                // a PIN lockout.
                const lockoutEndTime = await readLockoutEndTime()
                if (lockoutEndTime !== null) {
                    return { kind: 'locked', lockoutEndTime }
                }

                const expected = getSecretMetadata(BIOMETRIC_BLOB_KEY_ID)?.[
                    BIOMETRIC_TOKEN_HASH_METADATA_KEY
                ]
                // Wrapped so a failed keystore read (null) is distinguishable
                // from bytes that came back but did not decode; only the
                // latter says anything about the blob.
                const blobRead = await withSecret(
                    BIOMETRIC_BLOB_KEY_ID,
                    bytes => ({
                        decoded: decodeBiometricBlob(bytes),
                    }),
                )
                if (!blobRead) {
                    return { kind: 'failed', reason: 'unavailable' }
                }
                if (!blobRead.decoded || typeof expected !== 'string') {
                    await dropOptIn('rebind-required')
                    return { kind: 'mismatch' }
                }

                const released = await biometricsService.unwrapBiometricToken(
                    blobRead.decoded,
                    prompt,
                )
                if (!released.success) {
                    // The one reason that is affirmative rather than a prompt
                    // outcome: the OS destroyed the key.
                    if (released.reason === 'invalidated') {
                        await dropOptIn('enrollment-changed')
                        return { kind: 'mismatch' }
                    }
                    // A key that passes the ceremony and still cannot release
                    // the token is dead in every case but a pruned keystore
                    // operation, so it is dropped once that stops looking
                    // transient.
                    if (released.reason === 'decrypt-failed') {
                        const failures =
                            useSecurityStore.getState()
                                .biometricUnwrapFailures + 1
                        if (failures >= MAX_BIOMETRIC_UNWRAP_FAILURES) {
                            await dropOptIn('rebind-required')
                            return { kind: 'mismatch' }
                        }
                        setUnwrapFailures(failures)
                    }
                    return { kind: 'failed', reason: released.reason }
                }

                try {
                    // Only reachable through corruption: the released token is
                    // not the one that was sealed.
                    if (!matchesHash(released.token, expected)) {
                        await dropOptIn('rebind-required')
                        return { kind: 'mismatch' }
                    }
                } finally {
                    released.token.fill(0)
                }

                setUnwrapFailures(0)
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
            setUnwrapFailures,
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
