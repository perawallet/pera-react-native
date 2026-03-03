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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => {
            const store = new Map<string, string>()
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value)
                },
                removeItem: (key: string) => {
                    store.delete(key)
                },
            }
        },
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
})
