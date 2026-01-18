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
import { registerTestPlatform } from '@test-utils'

describe('services/security/store', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('initSecurityStore initializes the store with defaults', async () => {
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

        const { result } = renderHook(() => useSecurityStore())

        expect(result.current.isPinEnabled).toBe(false)
        expect(result.current.isBiometricEnabled).toBe(false)
        expect(result.current.failedAttempts).toBe(0)
        expect(result.current.lockoutEndTime).toBeNull()
        expect(result.current.lastBackgroundTime).toBeNull()
    })

    test('setIsPinEnabled updates PIN enabled state', async () => {
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

        const { result } = renderHook(() => useSecurityStore())

        act(() => {
            result.current.setIsPinEnabled(true)
        })

        expect(result.current.isPinEnabled).toBe(true)

        act(() => {
            result.current.setIsPinEnabled(false)
        })

        expect(result.current.isPinEnabled).toBe(false)
    })

    test('setIsBiometricEnabled updates biometric enabled state', async () => {
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

        const { result } = renderHook(() => useSecurityStore())

        act(() => {
            result.current.setIsBiometricEnabled(true)
        })

        expect(result.current.isBiometricEnabled).toBe(true)

        act(() => {
            result.current.setIsBiometricEnabled(false)
        })

        expect(result.current.isBiometricEnabled).toBe(false)
    })

    test('incrementFailedAttempts increases the counter', async () => {
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

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
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

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
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

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
        const { initSecurityStore, useSecurityStore } = await import('../store')

        initSecurityStore()

        const { result } = renderHook(() => useSecurityStore())

        act(() => {
            result.current.setIsPinEnabled(true)
            result.current.setIsBiometricEnabled(true)
            result.current.incrementFailedAttempts()
            result.current.setLockoutEndTime(Date.now())
        })

        expect(result.current.isPinEnabled).toBe(true)
        expect(result.current.isBiometricEnabled).toBe(true)

        act(() => {
            result.current.reset()
        })

        expect(result.current.isPinEnabled).toBe(false)
        expect(result.current.isBiometricEnabled).toBe(false)
        expect(result.current.failedAttempts).toBe(0)
        expect(result.current.lockoutEndTime).toBeNull()
    })
})
