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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

/**
 * Why biometric unlock stopped working without the user asking for it.
 *
 * The first two are affirmative reports that destroy the opt-in, recoverable by
 * re-enabling in the app — `enrollment-changed` immediately, `weak-biometric`
 * only once a class-3 biometric is enrolled. `not-available` is different in
 * kind: nothing is destroyed and it re-arms itself once the device is fixed, but
 * until then unlock silently does not happen, which is worth saying out loud.
 * Only persistent unavailability qualifies — a lockout clears on its own and is
 * never reported here.
 */
export type BiometricsDisabledReason =
    | 'enrollment-changed'
    | 'weak-biometric'
    | 'not-available'

export type SecurityState = BaseStoreState & {
    failedAttempts: number
    lockoutEndTime: Nullable<number>
    autoLockStartedAt: Nullable<number>
    /**
     * Monotonic counter that AutoLockGuard subscribes to. Any call to
     * `requestLock` increments it, triggering the guard to flip into the
     * locked state regardless of how long the app has been foregrounded.
     * Used by the shake-to-lock listener; future integrations (e.g. a
     * "lock now" menu item) can call the same action.
     */
    lockRequestVersion: number
    /**
     * Transient — deliberately excluded from persistence. True while
     * AutoLockGuard's overlay (the lock screen or the startup/foreground
     * check) covers the app. UI drivers hold NEW overlay presentation
     * (e.g. the sign-request sheet) while it is set, so nothing presents
     * into the covered layer and "pops in" when the PIN is accepted.
     * Mirrored by AutoLockGuard's useAutoLockListener.
     */
    isAppLockActive: boolean
    /**
     * Transient — deliberately excluded from persistence. Whether a biometric
     * blob is currently usable, shared so every consumer of `useBiometrics`
     * (Settings, the lock screen, PIN edit) sees the same answer. It was
     * per-hook state, so when a reconcile cleared a blob revoked in OS settings
     * only the calling screen updated and Settings kept showing the toggle ON.
     *
     * A cache, never the source of truth: the keystore blob is, and it is
     * re-read on every `checkBiometricsEnabled`. Persisting this would make a
     * tampered value claim biometrics are enabled.
     */
    isBiometricsEnabled: boolean
    /**
     * Why the reconcile turned biometric unlock off, so the app can offer it
     * back instead of leaving the user to discover the PIN pad and guess. Null
     * whenever the user is the one who turned it off — nobody should be
     * prompted to re-enable what they just disabled.
     *
     * Persisted, unlike the flag above: the drop happens while the app is
     * locked and the user may kill it before ever unlocking, and an offer to
     * re-enable is not a claim that anything is enabled.
     */
    biometricsDisabledReason: Nullable<BiometricsDisabledReason>
    /**
     * The reason the user has already declined to act on. Needed because
     * `not-available` is re-derived from live device state on every reconcile:
     * without this, dismissing it would only last until the next one and the
     * offer would return on every unlock. Cleared when the situation resolves,
     * so a later recurrence prompts again.
     */
    acknowledgedBiometricsDisabledReason: Nullable<BiometricsDisabledReason>

    incrementFailedAttempts: () => void
    setFailedAttempts: (count: number) => void
    resetFailedAttempts: () => void
    setLockoutEndTime: (time: Nullable<number>) => void
    setAutoLockStartedAt: (time: Nullable<number>) => void
    requestLock: () => void
    setAppLockActive: (active: boolean) => void
    setBiometricsEnabled: (enabled: boolean) => void
    setBiometricsDisabledReason: (
        reason: Nullable<BiometricsDisabledReason>,
    ) => void
    setAcknowledgedBiometricsDisabledReason: (
        reason: Nullable<BiometricsDisabledReason>,
    ) => void
}

export type PinEntryMode =
    | 'setup'
    | 'confirm'
    | 'verify'
    | 'change_old'
    | 'change_new'
    | 'change_confirm'
