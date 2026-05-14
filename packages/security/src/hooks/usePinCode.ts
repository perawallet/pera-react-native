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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSecurityStore } from '../store'
import {
    PIN_RECORD_KEY_ID,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
    AUTO_LOCK_TIMEOUT_MS,
} from '../constants'
import {
    type PinRecord,
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
    verifyPinAgainstRecord,
} from '../pinRecord'
import { useBiometrics } from './useBiometrics'
import { useKMSService } from '@perawallet/wallet-core-kms'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UsePinCodeResult = {
    failedAttempts: number
    lockoutEndTime: Nullable<number>
    isLockedOut: boolean
    remainingLockoutSeconds: number
    checkAutoLock: () => Promise<boolean>
    checkPinEnabled: () => Promise<boolean>
    savePin: (pin: Nullable<string>) => Promise<void>
    verifyPin: (pin: string) => Promise<boolean>
    handleFailedAttempt: () => Promise<void>
    resetFailedAttempts: () => Promise<void>
    setLockoutEndTime: (date: Nullable<number>) => Promise<void>
    getLockoutDuration: () => number
    setAutoLockStartedAt: (date: Nullable<number>) => void
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

    const {
        checkBiometricsEnabled,
        disableBiometrics,
        refreshBiometricsBinding,
    } = useBiometrics()

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
                bytes.fill(0)
            }
        },
        [commitSecret],
    )

    // Hydrate in-memory lockout state from the authoritative secure record.
    // The store is no longer persisted to MMKV for these fields, so clearing
    // MMKV cannot reset the lockout counter.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const record = await loadRecord()
            if (cancelled || !record) return
            setFailedAttemptsInStore(record.failedAttempts)
            setLockoutEndTimeInStore(record.lockoutEndTime)
        })()
        return () => {
            cancelled = true
        }
    }, [loadRecord, setFailedAttemptsInStore, setLockoutEndTimeInStore])

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
                const record = await createPinRecord(pin)
                await writeRecord(record)
                setFailedAttemptsInStore(0)
                setLockoutEndTimeInStore(null)
                // Re-bind the biometric blob to the new PinRecord bytes so
                // its content matches `PIN_RECORD_KEY_ID`. Critically, this
                // does NOT write the raw PIN — that previously meant a
                // 6-digit cleartext PIN sat in the keystore alongside the
                // PBKDF2-hashed record, defeating the hashing.
                await refreshBiometricsBinding()
            } else {
                await removeSecret(PIN_RECORD_KEY_ID)
                setFailedAttemptsInStore(0)
                setLockoutEndTimeInStore(null)
                if (await checkBiometricsEnabled()) {
                    await disableBiometrics()
                }
            }
            forceRefresh.current += 1
        },
        [
            removeSecret,
            writeRecord,
            setFailedAttemptsInStore,
            setLockoutEndTimeInStore,
            checkBiometricsEnabled,
            refreshBiometricsBinding,
            disableBiometrics,
        ],
    )

    const verifyPin = useCallback(
        async (pin: string): Promise<boolean> => {
            const record = await loadRecord()
            if (!record) return false
            return verifyPinAgainstRecord(pin, record)
        },
        [loadRecord],
    )

    const handleFailedAttempt = useCallback(async () => {
        const record = await loadRecord()
        const currentAttempts = record?.failedAttempts ?? failedAttempts
        const newAttempts = currentAttempts + 1
        const triggerLockout =
            newAttempts % MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT === 0
        const newLockoutEndTime = triggerLockout
            ? Date.now() +
              INITIAL_LOCKOUT_SECONDS *
                  2 **
                      (Math.floor(
                          newAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
                      ) -
                          1) *
                  1000
            : (record?.lockoutEndTime ?? lockoutEndTime)

        setFailedAttemptsInStore(newAttempts)
        if (triggerLockout) setLockoutEndTimeInStore(newLockoutEndTime)

        if (record) {
            await writeRecord({
                ...record,
                failedAttempts: newAttempts,
                lockoutEndTime: newLockoutEndTime,
            })
        }
    }, [
        loadRecord,
        writeRecord,
        failedAttempts,
        lockoutEndTime,
        setFailedAttemptsInStore,
        setLockoutEndTimeInStore,
    ])

    const checkAutoLock = useCallback(async () => {
        if (!(await checkPinEnabled())) return false
        if (autoLockStartedAt == null) return false
        const elapsed = Date.now() - autoLockStartedAt
        return elapsed > AUTO_LOCK_TIMEOUT_MS
    }, [autoLockStartedAt, checkPinEnabled])

    return {
        checkPinEnabled,
        failedAttempts,
        lockoutEndTime,
        isLockedOut,
        checkAutoLock,
        remainingLockoutSeconds,
        savePin,
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        getLockoutDuration,
        setLockoutEndTime,
        setAutoLockStartedAt,
    }
}
