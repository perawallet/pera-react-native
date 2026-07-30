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

import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    InvalidPasswordError,
    PasskeyUnlockError,
    VaultCorruptedError,
    VaultLockedOutError,
    getLockoutRemainingSeconds,
    isPasskeyUnlockEnabled,
    isPasskeyUnlockSupported,
    unlockVault,
    unlockWithPasskey,
} from '@perawallet/wallet-extension-keystore-chrome'

type UseUnlockScreenResult = {
    password: string
    isSubmitting: boolean
    isPasskeyPending: boolean
    hasError: boolean
    hasCorruptedVaultError: boolean
    hasPasskeyError: boolean
    canUsePasskey: boolean
    lockoutSeconds: number
    setPassword: (value: string) => void
    handleUnlock: () => Promise<void>
    handlePasskeyUnlock: () => Promise<void>
}

export const useUnlockScreen = (): UseUnlockScreenResult => {
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Tracks the passkey challenge separately from isSubmitting so a
    // password unlock stays available while a passkey prompt is in flight —
    // see the auto-launch effect below.
    const [isPasskeyPending, setIsPasskeyPending] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [hasCorruptedVaultError, setHasCorruptedVaultError] = useState(false)
    const [hasPasskeyError, setHasPasskeyError] = useState(false)
    const [canUsePasskey, setCanUsePasskey] = useState(false)
    // Once-per-mount latch for the auto-launch effect below. Burned the first
    // time that effect is able to DECIDE (see the effect's comment), not
    // only on a successful launch.
    const hasAutoLaunchedRef = useRef(false)
    // Tracks whether ANY passkey attempt — manual or automatic — has started
    // this mount, independent of hasAutoLaunchedRef. A manual "Use passkey"
    // tap can happen before the auto-launch effect below is ready to decide
    // (e.g. while lockout hydration is still in flight); if the user already
    // tried and cancelled, the automatic path must not also fire once it
    // becomes ready.
    const hasAttemptedPasskeyRef = useRef(false)
    // Gates auto-launch until isPasskeyUnlockSupported/isPasskeyUnlockEnabled
    // have actually resolved — see the effect below.
    const [isPasskeySupportChecked, setIsPasskeySupportChecked] =
        useState(false)
    // Gates auto-launch until the persisted lockout has actually been read —
    // see the effect below.
    const [isLockoutChecked, setIsLockoutChecked] = useState(false)
    // Absolute end time (not exposed) drives the countdown below — mirrors
    // useLockScreen.ts, which keys the single interval off lockoutEndTime
    // rather than the tick count, so it isn't torn down and recreated
    // every second.
    const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
    const [lockoutSeconds, setLockoutSeconds] = useState(0)

    useEffect(() => {
        let cancelled = false
        const check = async (): Promise<void> => {
            const [supported, enabled] = await Promise.all([
                isPasskeyUnlockSupported(),
                isPasskeyUnlockEnabled(),
            ])
            if (!cancelled) {
                setCanUsePasskey(supported && enabled)
                setIsPasskeySupportChecked(true)
            }
        }
        void check()
        return () => {
            cancelled = true
        }
    }, [])

    // Records that a passkey attempt started, regardless of source, so the
    // auto-launch effect below can tell a prior MANUAL attempt apart from
    // never having tried — see hasAttemptedPasskeyRef's own comment.
    useEffect(() => {
        if (isPasskeyPending) hasAttemptedPasskeyRef.current = true
    }, [isPasskeyPending])

    // Hydrate from the persisted lockout record so a popup re-open (or the
    // initial mount) still honors a lockout started in a previous session.
    useEffect(() => {
        let cancelled = false
        void getLockoutRemainingSeconds().then(seconds => {
            if (cancelled) return
            if (seconds > 0) {
                setLockoutEndTime(Date.now() + seconds * 1000)
                // Set lockoutSeconds directly, in the same batch as
                // isLockoutChecked below — otherwise it only gets its first
                // value from the countdown effect below reacting to
                // lockoutEndTime, which lands one commit later. The
                // auto-launch effect keys off isLockoutChecked immediately,
                // and without this it would see isLockoutChecked: true
                // alongside a stale lockoutSeconds: 0 and launch anyway.
                setLockoutSeconds(seconds)
            }
            setIsLockoutChecked(true)
        })
        return () => {
            cancelled = true
        }
    }, [])

    // 1s countdown while locked out, mirroring useLockScreen.ts (mobile PIN
    // lockout) lines 54-76.
    useEffect(() => {
        if (lockoutEndTime === null) {
            setLockoutSeconds(0)
            return
        }
        const updateRemaining = (): void => {
            const remaining = Math.max(
                0,
                Math.ceil((lockoutEndTime - Date.now()) / 1000),
            )
            setLockoutSeconds(remaining)
            if (remaining === 0) setLockoutEndTime(null)
        }
        updateRemaining()
        const interval = setInterval(updateRemaining, 1000)
        return () => clearInterval(interval)
    }, [lockoutEndTime])

    const handleUnlock = useCallback(async (): Promise<void> => {
        if (password.length === 0 || isSubmitting || lockoutSeconds > 0) return
        setIsSubmitting(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockVault(password)
            setPassword('')
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
                setPassword('')
            } else if (error instanceof VaultCorruptedError) {
                setHasCorruptedVaultError(true)
                setPassword('')
            } else if (error instanceof InvalidPasswordError) {
                setHasError(true)
                setPassword('')
                const seconds = await getLockoutRemainingSeconds()
                if (seconds > 0) setLockoutEndTime(Date.now() + seconds * 1000)
            } else {
                throw error
            }
        } finally {
            setIsSubmitting(false)
        }
    }, [password, isSubmitting, lockoutSeconds])

    const handlePasskeyUnlock = useCallback(async (): Promise<void> => {
        if (isPasskeyPending || isSubmitting || lockoutSeconds > 0) return
        setIsPasskeyPending(true)
        setHasError(false)
        setHasCorruptedVaultError(false)
        setHasPasskeyError(false)
        try {
            await unlockWithPasskey()
        } catch (error) {
            if (error instanceof VaultLockedOutError) {
                setLockoutEndTime(Date.now() + error.remainingSeconds * 1000)
            } else if (error instanceof VaultCorruptedError) {
                setHasCorruptedVaultError(true)
            } else if (
                error instanceof DOMException &&
                error.name === 'NotAllowedError'
            ) {
                // User cancelled the passkey prompt — treat as silent no-op.
            } else if (error instanceof PasskeyUnlockError) {
                setHasPasskeyError(true)
            } else {
                throw error
            }
        } finally {
            setIsPasskeyPending(false)
        }
    }, [isPasskeyPending, isSubmitting, lockoutSeconds])

    // Launch the biometric challenge as soon as we know a passkey is
    // available, instead of making the user tap "Use passkey" first.
    //
    // The once-per-mount latch (hasAutoLaunchedRef) is burned on the first
    // DECISION, not only on a successful launch: as soon as both mount
    // probes have resolved (isLockoutChecked and isPasskeySupportChecked),
    // this effect commits to either launching now or never launching
    // automatically again this mount — it does not keep re-evaluating as
    // lockoutSeconds/isSubmitting/isPasskeyPending change afterwards. That
    // is what stops a user who arrives already locked out from getting an
    // unprompted biometric dialog 30-120 seconds later when the countdown
    // reaches zero (the previous version re-armed on every tick because the
    // latch was never burned for a declined launch).
    //
    // hasAttemptedPasskeyRef covers the remaining gap: a manual "Use
    // passkey" tap can happen in the window before both probes resolve
    // (canUsePasskey can already be true while isLockoutChecked is still
    // pending). If the user already tried — and, say, cancelled — this
    // effect must not also auto-launch a second prompt once it becomes
    // ready to decide.
    //
    // isLockoutChecked doesn't itself protect a locked-out user from the
    // biometric prompt — unlockWithPasskey re-reads the lockout and throws
    // before ever calling navigator.credentials.get(), so no prompt reaches
    // the user either way. What it (and isPasskeySupportChecked) avoid is
    // deciding on a stale lockoutSeconds: 0 / canUsePasskey: false read
    // before that probe's real result has landed. Password unlock stays
    // fully available while the challenge is outstanding: the Unlock button
    // gates on isSubmitting only, but this effect checks both flags before
    // auto-launching, so the user can cancel the prompt or just keep typing
    // and submit the password.
    useEffect(() => {
        if (hasAutoLaunchedRef.current) return
        if (!isLockoutChecked || !isPasskeySupportChecked) return
        hasAutoLaunchedRef.current = true
        if (hasAttemptedPasskeyRef.current) return
        if (!canUsePasskey || lockoutSeconds > 0 || isSubmitting) return
        if (isPasskeyPending) return
        handlePasskeyUnlock().catch((error: unknown) => {
            // Reachable on real hardware — e.g. passkey.ts's PRF-mismatch
            // error, or a `navigator.credentials.get()` SecurityError /
            // AbortError / InvalidStateError / NotSupportedError.
            // handlePasskeyUnlock deliberately rethrows anything it doesn't
            // recognise (see its own contract), and at mount there is no
            // caller await to surface that rejection — without this it would
            // be an unhandled rejection with no user-visible state at all.
            logger.error('useUnlockScreen: passkey auto-launch failed', {
                error,
            })
            setHasPasskeyError(true)
        })
    }, [
        isLockoutChecked,
        isPasskeySupportChecked,
        canUsePasskey,
        lockoutSeconds,
        isSubmitting,
        isPasskeyPending,
        handlePasskeyUnlock,
    ])

    return {
        password,
        isSubmitting,
        isPasskeyPending,
        hasError,
        hasCorruptedVaultError,
        hasPasskeyError,
        canUsePasskey,
        lockoutSeconds,
        setPassword,
        handleUnlock,
        handlePasskeyUnlock,
    }
}
