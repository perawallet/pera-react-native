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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Nullable } from '@perawallet/wallet-core-shared'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
        createPersistStorage: createMockPersistStorage,
    }
})

describe('services/security/store', () => {
    beforeEach(async () => {
        vi.resetModules()
    })

    test('initSecurityStore initializes the store with defaults', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        expect(result.current.failedAttempts).toBe(0)
        expect(result.current.lockoutEndTime).toBeNull()
        expect(result.current.autoLockStartedAt).toBeNull()
    })

    test('setAutoLockStartedAt updates auto lock time', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        const lockTime = Date.now()

        act(() => {
            result.current.setAutoLockStartedAt(lockTime)
        })

        expect(result.current.autoLockStartedAt).toBe(lockTime)

        act(() => {
            result.current.setAutoLockStartedAt(null)
        })

        expect(result.current.autoLockStartedAt).toBeNull()
    })

    test('rehydration coerces a tampered autoLockStartedAt so auto-lock fails closed', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        for (const tampered of [
            Date.now() + 60 * 60 * 1000, // future
            -1, // negative
            'not-a-number', // wrong type
        ]) {
            vi.resetModules()
            getProvider().keyValueStorage.setItem(
                'security-store',
                JSON.stringify({
                    state: { autoLockStartedAt: tampered },
                    version: 1,
                }),
            )
            const { useSecurityStore } = await import('../store')
            // Coerced to epoch 0 → consumer reads a long-elapsed timer and
            // locks, rather than trusting the tampered value (which never fires).
            expect(useSecurityStore.getState().autoLockStartedAt).toBe(0)
        }
    })

    test('rehydration preserves a valid past autoLockStartedAt', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const past = Date.now() - 1000
        getProvider().keyValueStorage.setItem(
            'security-store',
            JSON.stringify({ state: { autoLockStartedAt: past }, version: 1 }),
        )
        const { useSecurityStore } = await import('../store')
        expect(useSecurityStore.getState().autoLockStartedAt).toBe(past)
    })

    test('incrementFailedAttempts increases the counter', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        expect(result.current.failedAttempts).toBe(0)

        act(() => {
            result.current.incrementFailedAttempts()
        })

        expect(result.current.failedAttempts).toBe(1)

        act(() => {
            result.current.incrementFailedAttempts()
        })

        expect(result.current.failedAttempts).toBe(2)
    })

    test('resetFailedAttempts resets the counter to zero', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        act(() => {
            result.current.incrementFailedAttempts()
            result.current.incrementFailedAttempts()
            result.current.incrementFailedAttempts()
        })

        expect(result.current.failedAttempts).toBe(3)

        act(() => {
            result.current.resetFailedAttempts()
        })

        expect(result.current.failedAttempts).toBe(0)
    })

    test('setLockoutEndTime updates lockout end time', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        const lockoutTime = Date.now() + 30000

        act(() => {
            result.current.setLockoutEndTime(lockoutTime)
        })

        expect(result.current.lockoutEndTime).toBe(lockoutTime)

        act(() => {
            result.current.setLockoutEndTime(null)
        })

        expect(result.current.lockoutEndTime).toBeNull()
    })

    test('reset restores initial state', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        act(() => {
            result.current.incrementFailedAttempts()
            result.current.setLockoutEndTime(Date.now())
            result.current.setAutoLockStartedAt(Date.now())
        })

        expect(result.current.failedAttempts).toBe(1)

        act(() => {
            result.current.resetState()
        })

        expect(result.current.failedAttempts).toBe(0)
        expect(result.current.lockoutEndTime).toBeNull()
        expect(result.current.autoLockStartedAt).toBeNull()
    })

    test('setAppLockActive toggles the transient overlay flag', async () => {
        const { useSecurityStore } = await import('../store')

        useSecurityStore.getState().resetState()

        const { result } = renderHook(() => useSecurityStore())

        expect(result.current.isAppLockActive).toBe(false)

        act(() => {
            result.current.setAppLockActive(true)
        })
        expect(result.current.isAppLockActive).toBe(true)

        act(() => {
            result.current.setAppLockActive(false)
        })
        expect(result.current.isAppLockActive).toBe(false)
    })

    test('isAppLockActive is never persisted', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { useSecurityStore } = await import('../store')

        act(() => {
            useSecurityStore.getState().setAppLockActive(true)
        })

        const raw = getProvider().keyValueStorage.getItem(
            'security-store',
        ) as Nullable<string>
        const persisted = raw ? JSON.parse(raw) : null
        expect(persisted?.state).not.toHaveProperty('isAppLockActive')
    })

    test('resetState clears the transient overlay flag', async () => {
        const { useSecurityStore } = await import('../store')

        act(() => {
            useSecurityStore.getState().setAppLockActive(true)
        })
        act(() => {
            useSecurityStore.getState().resetState()
        })

        expect(useSecurityStore.getState().isAppLockActive).toBe(false)
    })

    test('registers resetState and clearStorage callbacks', async () => {
        const { useSecurityStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('security-store')

        act(() => {
            useSecurityStore.getState().incrementFailedAttempts()
        })
        act(() => registration.resetState())
        expect(useSecurityStore.getState().failedAttempts).toBe(0)

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
