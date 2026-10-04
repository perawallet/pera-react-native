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
    BiometricsService,
    BiometricType,
    BiometricUnwrapFailureReason,
    BiometricUnwrapSession,
} from '@perawallet/wallet-extension-platform'
import { getKeystore, getProvider } from '@perawallet/wallet-extension-provider'
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
    /**
     * Finishes the upgrade the reconcile started: arms a fresh binding for a
     * swept pre-binding blob, with no ceremony. Only call it after the user
     * has just proven the PIN; a no-op when nothing is pending.
     */
    completePendingBiometricRearm: () => Promise<void>
}

// Module-level because every mounted instance reconciles on mount. A caller
// that lands between the blob's removal and the flag being set would see
// neither and skip the prompt, and a recovery that arms while the sweep's
// clear is in flight would lose its fresh key.
let legacySweep: Nullable<Promise<void>> = null

// Every native call here shares one Expo queue with the unlock prompt, so
// overlapping runs share one: the mounts with each other and the unlock with
// them. Shared only while in flight, so a joiner reads what the OS reported
// moments ago. An explicit `checkBiometricsEnabled` still runs afresh.
let inFlightReconcile: Nullable<Promise<boolean>> = null
let inFlightAvailability: Nullable<Promise<boolean>> = null

const checkAvailabilityShared = (
    service: BiometricsService,
): Promise<boolean> => {
    inFlightAvailability ??= service.checkBiometricsAvailable().finally(() => {
        inFlightAvailability = null
    })
    return inFlightAvailability
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
    const setRearmPending = useSecurityStore(
        state => state.setBiometricRearmPending,
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
            setRearmPending(false)
        },
        [
            removeSecret,
            biometricsService,
            setIsEnabled,
            setDisabledReason,
            setAcknowledgedReason,
            setUnwrapFailures,
            setRearmPending,
        ],
    )

    const checkBiometricsEnabled = useCallback(async (): Promise<boolean> => {
        // `hasSecret` reads keystore metadata that hydrates asynchronously, and
        // that hydration sits behind the keystore migrations — which only run
        // on the first launch after an update. Reading it early reports "no
        // blob", which silently disables the opt-in and skips the prompt. A
        // rejected hydration fails bootstrap on its own; here it just means
        // there is nothing to read.
        await getKeystore().ready.catch(() => undefined)

        // A blob from before OS-bound keys existed: nothing can unwrap it, so
        // it is swept without a probe, and the binding is re-armed once the
        // user has proven the PIN rather than asking them to opt in again.
        if (legacySweep || hasSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID)) {
            // Flag first, so a kill mid-sweep cannot drop the opt-in unflagged.
            legacySweep ??= (async () => {
                setIsEnabled(false)
                setRearmPending(true)
                await removeSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID)
                await biometricsService.clearEnrollmentBinding()
            })().finally(() => {
                legacySweep = null
            })
            await legacySweep
            return false
        }
        if (!hasSecret(BIOMETRIC_BLOB_KEY_ID)) {
            setIsEnabled(false)
            return false
        }

        // Android folds a self-clearing lockout in with "nothing enrolled"
        // here, so this branch may report disabled but never destroy.
        if (!(await checkAvailabilityShared(biometricsService))) {
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
        removeSecret,
        dropOptIn,
        biometricsService,
        setIsEnabled,
        setDisabledReason,
        acknowledgedReason,
        setAcknowledgedReason,
        setRearmPending,
    ])

    const checkBiometricsAvailable = useCallback(async (): Promise<boolean> => {
        return biometricsService.checkBiometricsAvailable()
    }, [biometricsService])

    const reconcile = useCallback((): Promise<boolean> => {
        inFlightReconcile ??= checkBiometricsEnabled().finally(() => {
            inFlightReconcile = null
        })
        return inFlightReconcile
    }, [checkBiometricsEnabled])

    useEffect(() => {
        void reconcile()
        // Behind hydration, as the reconcile's own availability read is, so
        // the two land together and share one.
        void getKeystore()
            .ready.catch(() => undefined)
            .then(() => checkAvailabilityShared(biometricsService))
            .then(setIsAvailable)
    }, [reconcile, biometricsService])

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
                // A fresh key must not inherit the count of the one it replaces.
                setUnwrapFailures(0)
                setRearmPending(false)
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
            setUnwrapFailures,
            setRearmPending,
            dropOptIn,
        ],
    )

    const completePendingBiometricRearm =
        useCallback(async (): Promise<void> => {
            if (!useSecurityStore.getState().isBiometricRearmPending) return
            // No ceremony, like the legacy import: the next unlock is the proof,
            // and the decrypt-failure counter bounds a key that turns out dead.
            const armed = await biometricsService.armBiometricBinding()
            if (!armed) {
                setRearmPending(false)
                setDisabledReason('rebind-required')
                return
            }
            try {
                await writeBiometricBlob(armed.blob, armed.tokenHash)
            } catch {
                await biometricsService.clearEnrollmentBinding()
                setRearmPending(false)
                setDisabledReason('rebind-required')
                return
            }
            setRearmPending(false)
            setIsEnabled(true)
            setDisabledReason(null)
            setUnwrapFailures(0)
        }, [
            biometricsService,
            writeBiometricBlob,
            setRearmPending,
            setIsEnabled,
            setDisabledReason,
            setUnwrapFailures,
        ])

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
        // Only the timestamp leaves the read; the record's hashes stay inside it.
        const endTime = await withSecret(
            PIN_RECORD_KEY_ID,
            bytes => parsePinRecord(bytes)?.lockoutEndTime ?? null,
        )
        return endTime != null && endTime > Date.now() ? endTime : null
    }, [withSecret])

    // Only a pre-binding opt-in swept by the reconcile and never re-armed; a
    // blob under the current id means the migration is done, and every path
    // that finishes or abandons it clears the flag.
    const isPendingRearmRecoverable = useCallback(
        (): boolean =>
            useSecurityStore.getState().isBiometricRearmPending &&
            !hasSecret(BIOMETRIC_BLOB_KEY_ID),
        [hasSecret],
    )

    // Users upgraded from a pre-binding build lose biometrics until their next
    // PIN entry, which strands anyone who has forgotten the PIN. This lets the
    // ceremony stand in for the PIN: arm, then unwrap as `enableBiometrics`
    // does. A failure leaves the flag set so the next lock can try again.
    const recoverPendingRearm = useCallback(
        async (
            prompt: BiometricsAuthenticatePrompt,
        ): Promise<BiometricUnlockOutcome> => {
            const lockoutEndTime = await readLockoutEndTime()
            if (lockoutEndTime !== null) {
                return { kind: 'locked', lockoutEndTime }
            }
            if (
                !(await biometricsService.checkBiometricsAvailable()) ||
                (await biometricsService.getSecurityLevel()) !== 'strong'
            ) {
                return { kind: 'failed', reason: 'unavailable' }
            }

            const armed = await biometricsService.armBiometricBinding()
            if (!armed) return { kind: 'failed', reason: 'unknown' }

            const released = await biometricsService.unwrapBiometricToken(
                armed.blob,
                prompt,
            )
            if (!released.success) {
                await biometricsService.clearEnrollmentBinding()
                return { kind: 'failed', reason: released.reason }
            }

            try {
                if (!matchesHash(released.token, armed.tokenHash)) {
                    await biometricsService.clearEnrollmentBinding()
                    return { kind: 'mismatch' }
                }
            } finally {
                released.token.fill(0)
            }

            try {
                await writeBiometricBlob(armed.blob, armed.tokenHash)
            } catch (err) {
                await biometricsService.clearEnrollmentBinding()
                throw err
            }
            setRearmPending(false)
            setIsEnabled(true)
            setDisabledReason(null)
            setUnwrapFailures(0)
            return { kind: 'ok' }
        },
        [
            readLockoutEndTime,
            biometricsService,
            writeBiometricBlob,
            setRearmPending,
            setIsEnabled,
            setDisabledReason,
            setUnwrapFailures,
        ],
    )

    const handleUnwrapFailure = useCallback(
        async (
            reason: BiometricUnwrapFailureReason,
        ): Promise<BiometricUnlockOutcome> => {
            // The one reason that is affirmative rather than a prompt outcome:
            // the OS destroyed the key.
            if (reason === 'invalidated') {
                await dropOptIn('enrollment-changed')
                return { kind: 'mismatch' }
            }
            // A key that passes the ceremony and still cannot release the
            // token is dead in every case but a pruned keystore operation, so
            // it is dropped once that stops looking transient.
            if (reason === 'decrypt-failed') {
                const failures =
                    useSecurityStore.getState().biometricUnwrapFailures + 1
                if (failures >= MAX_BIOMETRIC_UNWRAP_FAILURES) {
                    await dropOptIn('rebind-required')
                    return { kind: 'mismatch' }
                }
                setUnwrapFailures(failures)
            }
            return { kind: 'failed', reason }
        },
        [dropOptIn, setUnwrapFailures],
    )

    // The prompt goes up before the reconcile and the keystore reads settle,
    // because on a slow keystore they queue behind every other caller for
    // seconds. Nothing they decide is skipped, only reordered: a refusal
    // dismisses the prompt, and a passed ceremony only becomes an unlock once
    // both have agreed and the token checks out.
    const unlockWithBiometrics = useCallback(
        async (
            prompt: BiometricsAuthenticatePrompt,
        ): Promise<BiometricUnlockOutcome> => {
            let session: Nullable<BiometricUnwrapSession> = null
            let isFinishing = false
            try {
                // `hasSecret` needs the hydrated metadata.
                await getKeystore().ready.catch(() => undefined)

                // With no current blob there is nothing to unwrap yet, and a
                // legacy one has to be swept first, so the reconcile runs
                // before any prompt; it may still find a blob written since.
                let enabled: Nullable<Promise<boolean>> = null
                const hasCurrentBlob =
                    !legacySweep &&
                    !hasSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID) &&
                    hasSecret(BIOMETRIC_BLOB_KEY_ID)
                if (!hasCurrentBlob) {
                    enabled = reconcile()
                    if (!(await enabled)) {
                        if (isPendingRearmRecoverable()) {
                            return await recoverPendingRearm(prompt)
                        }
                        return { kind: 'failed', reason: 'unavailable' }
                    }
                }

                // First, so no reconcile call is queued ahead of it natively.
                const activeSession =
                    biometricsService.beginBiometricUnwrap(prompt)
                session = activeSession
                enabled ??= reconcile()
                const verifiedEnabled = enabled

                // Wrapped so a failed keystore read (null) is distinguishable
                // from bytes that came back but did not decode; only the latter
                // says anything about the blob.
                const lockoutRead = readLockoutEndTime()
                const blobRead = withSecret(BIOMETRIC_BLOB_KEY_ID, bytes => ({
                    decoded: decodeBiometricBlob(bytes),
                }))
                // Only for reads a refusal abandons; an awaited one still
                // throws.
                lockoutRead.catch(() => undefined)
                blobRead.catch(() => undefined)

                const refusal = (async (): Promise<
                    Nullable<BiometricUnlockOutcome>
                > => {
                    if (!(await verifiedEnabled)) {
                        return { kind: 'failed', reason: 'unavailable' }
                    }
                    // The store's lockout flag is not hydrated yet on a cold
                    // start; the record is the authority, and biometrics must
                    // not outrank a PIN lockout.
                    const lockoutEndTime = await lockoutRead
                    return lockoutEndTime === null
                        ? null
                        : { kind: 'locked', lockoutEndTime }
                })()
                // Dismissed as soon as the answer is no, not after the user
                // authenticates against a prompt that cannot unlock.
                refusal.then(
                    outcome => {
                        if (outcome) void activeSession.cancel()
                    },
                    () => undefined,
                )

                // A refusal does not wait for the dismissed ceremony to report
                // back; a passed ceremony still waits for the refusal check.
                const first = await Promise.race([
                    refusal.then(outcome =>
                        outcome
                            ? { refused: outcome }
                            : new Promise<never>(() => undefined),
                    ),
                    activeSession.authenticated.then(result => ({
                        ceremony: result,
                    })),
                ])
                if ('refused' in first) return first.refused
                const { ceremony } = first
                const refused = await refusal
                if (refused) return refused
                if (!ceremony.success) {
                    return await handleUnwrapFailure(ceremony.reason)
                }

                const expected = getSecretMetadata(BIOMETRIC_BLOB_KEY_ID)?.[
                    BIOMETRIC_TOKEN_HASH_METADATA_KEY
                ]
                const blob = await blobRead
                if (!blob) {
                    return { kind: 'failed', reason: 'unavailable' }
                }
                if (!blob.decoded || typeof expected !== 'string') {
                    await dropOptIn('rebind-required')
                    return { kind: 'mismatch' }
                }

                // A wrong PIN entered during the ceremony writes its lockout
                // after the record read; the store already has it.
                const storeLockoutEndTime =
                    useSecurityStore.getState().lockoutEndTime
                if (
                    storeLockoutEndTime !== null &&
                    storeLockoutEndTime > Date.now()
                ) {
                    return {
                        kind: 'locked',
                        lockoutEndTime: storeLockoutEndTime,
                    }
                }

                isFinishing = true
                const released = await activeSession.finish(blob.decoded)
                if (!released.success) {
                    return await handleUnwrapFailure(released.reason)
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
            } finally {
                // Every exit short of `finish` must release the key a passed
                // ceremony left authorised.
                if (session && !isFinishing) void session.cancel()
            }
        },
        [
            reconcile,
            isPendingRearmRecoverable,
            recoverPendingRearm,
            readLockoutEndTime,
            hasSecret,
            getSecretMetadata,
            withSecret,
            biometricsService,
            dropOptIn,
            handleUnwrapFailure,
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
        completePendingBiometricRearm,
    }
}

export type { BiometricType, BiometricsAuthenticateFailureReason }
