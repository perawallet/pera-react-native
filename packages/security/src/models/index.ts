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

import {
    type BaseStoreState,
    type Nullable,
} from '@perawallet/wallet-core-shared'

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
     * into the covered layer and "pops in" when the PIN is accepted
     * (PERA-4743). Mirrored by AutoLockGuard's useAutoLockListener.
     */
    isAppLockActive: boolean
    /**
     * Transient — deliberately excluded from persistence. Whether a biometric
     * blob is currently usable, shared so every consumer of `useBiometrics`
     * (Settings, the lock screen, PIN edit) sees the same answer. It was
     * per-hook state, so when a reconcile cleared a blob revoked in OS settings
     * only the calling screen updated and Settings kept showing the toggle ON
     * (PERA-4702).
     *
     * A cache, never the source of truth: the keystore blob is, and it is
     * re-read on every `checkBiometricsEnabled`. Persisting this would make a
     * tampered value claim biometrics are enabled.
     */
    isBiometricsEnabled: boolean

    incrementFailedAttempts: () => void
    setFailedAttempts: (count: number) => void
    resetFailedAttempts: () => void
    setLockoutEndTime: (time: Nullable<number>) => void
    setAutoLockStartedAt: (time: Nullable<number>) => void
    requestLock: () => void
    setAppLockActive: (active: boolean) => void
    setBiometricsEnabled: (enabled: boolean) => void
}

export type PinEntryMode =
    | 'setup'
    | 'confirm'
    | 'verify'
    | 'change_old'
    | 'change_new'
    | 'change_confirm'
