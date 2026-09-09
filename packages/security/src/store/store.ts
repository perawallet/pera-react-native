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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { BiometricsDisabledReason, SecurityState } from '../models'
import {
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'security-store'

const initialState = {
    failedAttempts: 0,
    lockoutEndTime: null,
    autoLockStartedAt: null,
    lockRequestVersion: 0,
    isAppLockActive: false,
    isBiometricsEnabled: false,
    biometricsDisabledReason: null,
    acknowledgedBiometricsDisabledReason: null,
    biometricUnwrapFailures: 0,
    isBiometricRearmPending: false,
}

// `autoLockStartedAt` is persisted to unencrypted storage; a tampered/corrupt
// value must never disable auto-lock. `null` legitimately means "no timer
// running" (consumer treats it as unlocked), so an invalid persisted value
// can't be sanitized to `null` — that would fail open. Coerce it to epoch `0`
// instead, which the consumer reads as a long-elapsed timer and locks.
const sanitizeAutoLockStartedAt = (value: unknown): Nullable<number> => {
    if (value == null) return null
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > Date.now()
    ) {
        return 0
    }
    return value
}

// A Record rather than a list so adding a reason without listing it here is a
// type error: a reason missing from this map is silently dropped on restart.
const DISABLED_REASONS: Record<BiometricsDisabledReason, true> = {
    'enrollment-changed': true,
    'weak-biometric': true,
    'not-available': true,
    'rebind-required': true,
}

// Drives copy in a sheet, so an unrecognized persisted value has no safe
// rendering — drop it and simply don't offer the prompt.
const sanitizeDisabledReason = (
    value: unknown,
): Nullable<BiometricsDisabledReason> =>
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(DISABLED_REASONS, value)
        ? (value as BiometricsDisabledReason)
        : null

// A tampered count only moves the drop earlier or later; zero changes nothing.
const sanitizeUnwrapFailures = (value: unknown): number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0
        ? value
        : 0

export const useSecurityStore: UseBoundStore<
    WithPersist<StoreApi<SecurityState>, unknown>
> = create<SecurityState>()(
    persist(
        set => ({
            ...initialState,
            incrementFailedAttempts: () =>
                set(state => ({
                    failedAttempts: state.failedAttempts + 1,
                })),
            setFailedAttempts: (count: number) =>
                set({ failedAttempts: count }),
            resetFailedAttempts: () => set({ failedAttempts: 0 }),
            setLockoutEndTime: (time: Nullable<number>) =>
                set({ lockoutEndTime: time }),
            setAutoLockStartedAt: (date: Nullable<number>) =>
                set({ autoLockStartedAt: date }),
            requestLock: () =>
                set(state => ({
                    lockRequestVersion: state.lockRequestVersion + 1,
                })),
            setAppLockActive: (active: boolean) =>
                set({ isAppLockActive: active }),
            setBiometricsEnabled: (enabled: boolean) =>
                set({ isBiometricsEnabled: enabled }),
            setBiometricsDisabledReason: (
                reason: Nullable<BiometricsDisabledReason>,
            ) => set({ biometricsDisabledReason: reason }),
            setAcknowledgedBiometricsDisabledReason: (
                reason: Nullable<BiometricsDisabledReason>,
            ) => set({ acknowledgedBiometricsDisabledReason: reason }),
            setBiometricUnwrapFailures: (count: number) =>
                set({ biometricUnwrapFailures: count }),
            setBiometricRearmPending: (pending: boolean) =>
                set({ isBiometricRearmPending: pending }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                autoLockStartedAt: state.autoLockStartedAt,
                biometricsDisabledReason: state.biometricsDisabledReason,
                acknowledgedBiometricsDisabledReason:
                    state.acknowledgedBiometricsDisabledReason,
                biometricUnwrapFailures: state.biometricUnwrapFailures,
                isBiometricRearmPending: state.isBiometricRearmPending,
            }),
            merge: (persisted, current) => {
                const stored = persisted as Partial<SecurityState> | undefined
                return {
                    ...current,
                    autoLockStartedAt: sanitizeAutoLockStartedAt(
                        stored?.autoLockStartedAt,
                    ),
                    biometricsDisabledReason: sanitizeDisabledReason(
                        stored?.biometricsDisabledReason,
                    ),
                    acknowledgedBiometricsDisabledReason:
                        sanitizeDisabledReason(
                            stored?.acknowledgedBiometricsDisabledReason,
                        ),
                    biometricUnwrapFailures: sanitizeUnwrapFailures(
                        stored?.biometricUnwrapFailures,
                    ),
                    // A forged true only re-arms after the PIN is proven.
                    isBiometricRearmPending:
                        stored?.isBiometricRearmPending === true,
                }
            },
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSecurityStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSecurityStore.getState().resetState(),
})
