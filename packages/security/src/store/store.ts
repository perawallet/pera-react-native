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

// Drives copy in a sheet, so an unrecognized persisted value has no safe
// rendering — drop it and simply don't offer the prompt.
const sanitizeDisabledReason = (
    value: unknown,
): Nullable<BiometricsDisabledReason> =>
    value === 'enrollment-changed' || value === 'weak-biometric' ? value : null

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
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                autoLockStartedAt: state.autoLockStartedAt,
                biometricsDisabledReason: state.biometricsDisabledReason,
            }),
            merge: (persisted, current) => ({
                ...current,
                autoLockStartedAt: sanitizeAutoLockStartedAt(
                    (persisted as Partial<SecurityState> | undefined)
                        ?.autoLockStartedAt,
                ),
                biometricsDisabledReason: sanitizeDisabledReason(
                    (persisted as Partial<SecurityState> | undefined)
                        ?.biometricsDisabledReason,
                ),
            }),
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
