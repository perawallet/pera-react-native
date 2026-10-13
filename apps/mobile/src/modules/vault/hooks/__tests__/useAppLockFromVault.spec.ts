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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSecurityStore } from '@perawallet/wallet-core-security'

const mocks = vi.hoisted(() => ({
    isUnlocked: null as boolean | null,
}))

vi.mock('../useVaultLockState.web', () => ({
    useVaultLockState: () => ({
        isInitialized: true,
        isUnlocked: mocks.isUnlocked,
        refresh: vi.fn(),
    }),
}))

import { useAppLockFromVault } from '../useAppLockFromVault.web'

describe('useAppLockFromVault', () => {
    beforeEach(() => {
        useSecurityStore.getState().setAppLockActive(true)
    })

    it('clears the app lock while the vault is unlocked', () => {
        mocks.isUnlocked = true

        renderHook(() => useAppLockFromVault())

        expect(useSecurityStore.getState().isAppLockActive).toBe(false)
    })

    it('sets the app lock again when the vault locks', () => {
        mocks.isUnlocked = true
        const { rerender } = renderHook(() => useAppLockFromVault())

        mocks.isUnlocked = false
        rerender()

        expect(useSecurityStore.getState().isAppLockActive).toBe(true)
    })

    it('keeps the app locked while the lock state is still resolving', () => {
        mocks.isUnlocked = null

        renderHook(() => useAppLockFromVault())

        expect(useSecurityStore.getState().isAppLockActive).toBe(true)
    })

    it('sets the app lock again when it unmounts', () => {
        mocks.isUnlocked = true
        const { unmount } = renderHook(() => useAppLockFromVault())

        unmount()

        expect(useSecurityStore.getState().isAppLockActive).toBe(true)
    })
})
