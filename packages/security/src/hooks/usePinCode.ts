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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSecurityStore } from '../store'
import {
    PIN_RECORD_KEY_ID,
    LEGACY_DURESS_PIN_RECORD_KEY_ID,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
    AUTO_LOCK_TIMEOUT_MS,
} from '../constants'
import {
    type PinRecord,
    applyDuressPin,
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
    verifyPinAgainstDuressSlot,
    verifyPinAgainstRecord,
} from '../pinRecord'
import { migratePinRecordToV3 } from '../pinRecordMigration'
import { useBiometrics } from './useBiometrics'
import { useKMSService, zeroBytes } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'

type VerifyPinResult = { kind: 'ok' } | { kind: 'duress' } | { kind: 'fail' }

type UsePinCodeResult = {
    failedAttempts: number
    lockoutEndTime: Nullable<number>
    isLockedOut: boolean
    remainingLockoutSeconds: number
    checkAutoLock: () => Promise<boolean>
    checkPinEnabled: () => Promise<boolean>
    savePin: (pin: Nullable<string>) => Promise<void>
    /**
     * Compares the entered PIN against both the regular and duress records.
     *
     * - `ok`: matches the regular PIN. Caller should unlock normally.
     * - `duress`: matches the duress PIN. Caller is responsible for triggering
     *   the duress wipe + decoy provisioning. Costs no attempt, so the duress
     *   path is always reachable, even when failed attempts have triggered a
     *   lockout — the duress comparison also bypasses the lockout gate.
     * - `fail`: matches neither.
     *
     * Attempt bookkeeping is owned here, not by the caller: the attempt is
     * charged to the record before the comparison runs and refunded on
     * success, so killing the app mid-attempt cannot buy a free guess.
     */
    verifyPin: (pin: string) => Promise<VerifyPinResult>
    resetFailedAttempts: () => Promise<void>
    setLockoutEndTime: (date: Nullable<number>) => Promise<void>
    getLockoutDuration: () => number
    setAutoLockStartedAt: (date: Nullable<number>) => void
    saveDuressPin: (pin: Nullable<string>) => Promise<void>
    checkDuressPinEnabled: () => Promise<boolean>
}

const calculateLockoutSeconds = (failedAttempts: number): number => {
    const lockoutBlock = Math.floor(
        failedAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    )
    if (lockoutBlock === 0) return 0
    return INITIAL_LOCKOUT_SECONDS * 2 ** (lockoutBlock - 1)
}

export const usePinCode = (): UsePinCodeResult => {
    const forceRefresh = useRef(0)
    const { commitSecret, withSecret, hasSecret, removeSecret } =
        useKMSService()
    const failedAttempts = useSecurityStore(state => state.failedAttempts)
    const setFailedAttemptsInStore = useSecurityStore(
        state => state.setFailedAttempts,
    )
    const resetFailedAttemptsInStore = useSecurityStore(
        state => state.resetFailedAttempts,
    )
    const lockoutEndTime = useSecurityStore(state => state.lockoutEndTime)
    const setLockoutEndTimeInStore = useSecurityStore(
        state => state.setLockoutEndTime,
    )
    const autoLockStartedAt = useSecurityStore(state => state.autoLockStartedAt)
    const setAutoLockStartedAt = useSecurityStore(
        state => state.setAutoLockStartedAt,
    )

    const { disableBiometrics, completePendingBiometricRearm } = useBiometrics()

    const isLockedOut = useMemo(
        () => lockoutEndTime !== null && Date.now() < lockoutEndTime,
        [lockoutEndTime],
    )

    const remainingLockoutSeconds = lockoutEndTime
        ? Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
        : 0

    const loadRecord = useCallback(async (): Promise<PinRecord | null> => {
        return withSecret(PIN_RECORD_KEY_ID, parsePinRecord)
    }, [withSecret])

    const writeRecord = useCallback(
        async (record: PinRecord): Promise<void> => {
            const bytes = serializePinRecord(record)
            try {
                await commitSecret({
                    id: PIN_RECORD_KEY_ID,
                    bytes,
                })
            } finally {
                zeroBytes(bytes)
            }
        },
        [commitSecret],
    )

    // Hydrate in-memory lockout state from the authoritative secure record.
    // The store is no longer persisted to MMKV for these fields, so clearing
    // MMKV cannot reset the lockout counter.
    //
    // The legacy-record migration runs first, eagerly: the separate v2 duress
    // record's key id sits in the keystore's plaintext metadata bucket, so it
    // must disappear at launch, not on the next PIN interaction. Rewriting the
    // record does not touch biometrics: the blob holds a random token sealed by
    // an OS-bound key, not a mirror of these bytes, so it stays valid.
    useEffect(() => {
        let cancelled = false
        void (async () => {
            await migratePinRecordToV3({
                withSecret,
                commitSecret,
                removeSecret,
            })
            const record = await loadRecord()
            if (cancelled || !record) return
            setFailedAttemptsInStore(record.failedAttempts)
            setLockoutEndTimeInStore(record.lockoutEndTime)
        })()
        return () => {
            cancelled = true
        }
    }, [
        withSecret,
        commitSecret,
        removeSecret,
        loadRecord,
        setFailedAttemptsInStore,
        setLockoutEndTimeInStore,
    ])

    const checkPinEnabled = useCallback(async (): Promise<boolean> => {
        return hasSecret(PIN_RECORD_KEY_ID)
    }, [hasSecret])

    const getLockoutDuration = useCallback(
        () => calculateLockoutSeconds(failedAttempts),
        [failedAttempts],
    )

    const resetFailedAttempts = useCallback(async () => {
        resetFailedAttemptsInStore()
        setLockoutEndTimeInStore(null)
        const record = await loadRecord()
        if (!record) return
        if (record.failedAttempts === 0 && record.lockoutEndTime === null)
            return
        await writeRecord({
            ...record,
            failedAttempts: 0,
            lockoutEndTime: null,
        })
    }, [
        resetFailedAttemptsInStore,
        setLockoutEndTimeInStore,
        loadRecord,
        writeRecord,
    ])

    const setLockoutEndTime = useCallback(
        async (date: number | null) => {
            setLockoutEndTimeInStore(date)
            const record = await loadRecord()
            if (!record) return
            if (record.lockoutEndTime === date) return
            await writeRecord({ ...record, lockoutEndTime: date })
        },
        [setLockoutEndTimeInStore, loadRecord, writeRecord],
    )

    const savePin = useCallback(
        async (pin: Nullable<string>) => {
            if (pin) {
                const existing = await loadRecord()
                let record = await createPinRecord(pin)
                // A PIN change must not silently disarm the duress PIN, which
                // now lives inside the same record.
                if (existing?.duressEnabled === 1) {
                    record = {
                        ...record,
                        duressSalt: existing.duressSalt,
                        duressHash: existing.duressHash,
                        duressEnabled: 1,
                    }
                }
                await writeRecord(record)
                setFailedAttemptsInStore(0)
                setLockoutEndTimeInStore(null)
                // Nothing to re-bind: the biometric blob holds a random token, not a copy of
                // the PIN record, so a new PIN neither invalidates nor needs to touch it.
            } else {
                await removeSecret(PIN_RECORD_KEY_ID)
                // The duress slot lives inside the record just removed; this
                // clears the pre-migration standalone record, should teardown
                // run before the launch migration has.
                await removeSecret(LEGACY_DURESS_PIN_RECORD_KEY_ID)
                setFailedAttemptsInStore(0)
                setLockoutEndTimeInStore(null)
                // Unconditional: `checkBiometricsEnabled` reporting false no
                // longer implies the blob is gone — it keeps one whose
                // enrollment it could not confirm — and `disableBiometrics` is
                // an idempotent delete. Guarding here would strand a blob
                // whose PIN just got removed above, unreachable until the
                // next unlock ceremony revokes it.
                await disableBiometrics()
            }
            forceRefresh.current += 1
        },
        [
            loadRecord,
            removeSecret,
            writeRecord,
            setFailedAttemptsInStore,
            setLockoutEndTimeInStore,
            disableBiometrics,
        ],
    )

    const verifyPin = useCallback(
        async (pin: string): Promise<VerifyPinResult> => {
            const record = await loadRecord()
            if (!record) return { kind: 'fail' }
            // Enforce lockout from the authoritative record itself, not just
            // the async-hydrated store flag — closes the startup race where a
            // guess slips through before the in-memory lockout state loads.
            // Fail closed: when the record says locked, the regular PIN cannot
            // succeed. The duress slot below stays reachable on purpose.
            const lockedByRecord =
                record.lockoutEndTime !== null &&
                Date.now() < record.lockoutEndTime

            // Only the record is charged up front; the store waits for a
            // `fail`, or a correct PIN on a lockout boundary would flash the
            // lockout screen while the hashes run.
            const newAttempts = record.failedAttempts + 1
            const triggerLockout =
                newAttempts % MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT === 0
            const charged: PinRecord = {
                ...record,
                failedAttempts: newAttempts,
                lockoutEndTime: triggerLockout
                    ? Date.now() + calculateLockoutSeconds(newAttempts) * 1000
                    : record.lockoutEndTime,
            }
            await writeRecord(charged)

            // Both slots are hashed on EVERY attempt — the duress slot holds
            // random fill when no duress PIN is set — so an attempt's cost
            // never reveals whether the feature is configured. Do not
            // short-circuit either comparison, including on a regular match:
            // a duress unlock must be timing-indistinguishable from a normal
            // one to someone watching the user enter it.
            const regularOk = lockedByRecord
                ? false
                : await verifyPinAgainstRecord(pin, record)
            // Overlaps the duress hash instead of lengthening the unlock, but
            // settles before `ok` returns: a put awaits the Keychain and a
            // remove does not, so a late refund would restore a removed record.
            const refund = regularOk
                ? writeRecord({
                      ...record,
                      failedAttempts: 0,
                      lockoutEndTime: null,
                  }).catch(error => {
                      logger.warn(
                          'PIN attempt refund failed; the attempt stays charged',
                          { error },
                      )
                  })
                : null
            const duressOk = await verifyPinAgainstDuressSlot(pin, record)

            if (regularOk) {
                await refund
                resetFailedAttemptsInStore()
                setLockoutEndTimeInStore(null)
                // Not awaited, though that only helps so much: arming holds
                // the Android keystore while it runs, so anything the unlock
                // reads from it queues behind arming either way.
                void completePendingBiometricRearm()
                return { kind: 'ok' }
            }
            // The duress comparison deliberately bypasses the lockout gate
            // (the caller's `isLockedOut` check) — duress must be reachable
            // even mid-lockout, otherwise an attacker could lock the user out
            // and then demand the regular PIN. The charge is reverted to the
            // pre-attempt counter rather than zeroed: zeroing would let a
            // duress entry clear an accumulated lockout on the settings path,
            // where duress does not wipe.
            // duress: do not emit telemetry on this branch.
            if (duressOk) {
                await writeRecord(record)
                return { kind: 'duress' }
            }
            setFailedAttemptsInStore(newAttempts)
            if (triggerLockout) setLockoutEndTimeInStore(charged.lockoutEndTime)
            return { kind: 'fail' }
        },
        [
            loadRecord,
            writeRecord,
            resetFailedAttemptsInStore,
            setFailedAttemptsInStore,
            setLockoutEndTimeInStore,
            completePendingBiometricRearm,
        ],
    )

    const checkAutoLock = useCallback(async () => {
        if (!(await checkPinEnabled())) return false
        if (autoLockStartedAt == null) return false
        // Fail closed on a tampered/corrupted persisted timestamp: a non-finite
        // (e.g. NaN) or future value would otherwise make the elapsed check
        // false and silently skip the lock. Treat anything but a valid past
        // timestamp as "should lock".
        if (
            !Number.isFinite(autoLockStartedAt) ||
            autoLockStartedAt > Date.now()
        )
            return true
        const elapsed = Date.now() - autoLockStartedAt
        return elapsed > AUTO_LOCK_TIMEOUT_MS
    }, [autoLockStartedAt, checkPinEnabled])

    const checkDuressPinEnabled = useCallback(async (): Promise<boolean> => {
        const record = await loadRecord()
        return record?.duressEnabled === 1
    }, [loadRecord])

    const saveDuressPin = useCallback(
        async (pin: Nullable<string>) => {
            const record = await loadRecord()
            if (!record) {
                // Disarming with nothing stored is a no-op; arming without a
                // regular PIN would strand a duress slot no lock screen can
                // ever reach.
                if (!pin) return
                throw new Error(
                    'Cannot configure a duress PIN before a regular PIN exists',
                )
            }
            await writeRecord(await applyDuressPin(record, pin))
            forceRefresh.current += 1
        },
        [loadRecord, writeRecord],
    )

    return {
        checkPinEnabled,
        failedAttempts,
        lockoutEndTime,
        isLockedOut,
        checkAutoLock,
        remainingLockoutSeconds,
        savePin,
        verifyPin,
        resetFailedAttempts,
        getLockoutDuration,
        setLockoutEndTime,
        setAutoLockStartedAt,
        saveDuressPin,
        checkDuressPinEnabled,
    }
}
