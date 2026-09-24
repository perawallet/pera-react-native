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

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

import { useNotificationsStore } from '../../store'
import { useNotificationPreferences } from '../useNotificationPreferences'

describe('useNotificationPreferences', () => {
    beforeEach(() => {
        useNotificationsStore.getState().resetState()
    })

    test('returns empty disabled accounts by default', () => {
        const { result } = renderHook(() => useNotificationPreferences())

        expect(result.current.disabledAccounts).toEqual([])
    })

    test('isAccountEnabled returns true for accounts not in disabled list', () => {
        const { result } = renderHook(() => useNotificationPreferences())

        expect(result.current.isAccountEnabled('test-address')).toBe(true)
    })

    test('setAccountEnabled disables an account when set to false', () => {
        const { result } = renderHook(() => useNotificationPreferences())

        act(() => {
            result.current.setAccountEnabled('test-address', false)
        })

        expect(result.current.isAccountEnabled('test-address')).toBe(false)
        expect(result.current.disabledAccounts).toContain('test-address')
    })

    test('setAccountEnabled enables a previously disabled account', () => {
        const { result } = renderHook(() => useNotificationPreferences())

        act(() => {
            result.current.setAccountEnabled('test-address', false)
        })

        expect(result.current.isAccountEnabled('test-address')).toBe(false)

        act(() => {
            result.current.setAccountEnabled('test-address', true)
        })

        expect(result.current.isAccountEnabled('test-address')).toBe(true)
        expect(result.current.disabledAccounts).not.toContain('test-address')
    })

    test('handles multiple accounts independently', () => {
        const { result } = renderHook(() => useNotificationPreferences())

        act(() => {
            result.current.setAccountEnabled('address-1', false)
            result.current.setAccountEnabled('address-2', false)
        })

        expect(result.current.isAccountEnabled('address-1')).toBe(false)
        expect(result.current.isAccountEnabled('address-2')).toBe(false)
        expect(result.current.isAccountEnabled('address-3')).toBe(true)

        act(() => {
            result.current.setAccountEnabled('address-1', true)
        })

        expect(result.current.isAccountEnabled('address-1')).toBe(true)
        expect(result.current.isAccountEnabled('address-2')).toBe(false)
    })
})
