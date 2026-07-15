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

const registerStoreMock = vi.fn()

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

describe('services/notifications/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('store initializes with defaults', async () => {
        const { useNotificationsStore } = await import('../store')

        const { result } = renderHook(() => useNotificationsStore())

        expect(result.current.notificationDisabledAccounts).toEqual([])
    })

    test('setAccountNotificationEnabled toggles account notification state', async () => {
        const { useNotificationsStore } = await import('../store')

        const { result } = renderHook(() => useNotificationsStore())

        act(() => {
            result.current.setAccountNotificationEnabled('test', true)
        })

        expect(result.current.isAccountNotificationEnabled('test')).toBe(true)

        act(() => {
            result.current.setAccountNotificationEnabled('test', false)
        })

        expect(result.current.isAccountNotificationEnabled('test')).toBe(false)
    })

    test('disabling an already-disabled account is a no-op (no duplicates)', async () => {
        const { useNotificationsStore } = await import('../store')
        const { result } = renderHook(() => useNotificationsStore())

        act(() => {
            result.current.setAccountNotificationEnabled('test', false)
            result.current.setAccountNotificationEnabled('test', false)
        })

        expect(result.current.notificationDisabledAccounts).toEqual(['test'])
    })

    test('resetState reverts to initial values', async () => {
        const { useNotificationsStore } = await import('../store')

        const { result } = renderHook(() => useNotificationsStore())

        act(() => {
            result.current.setAccountNotificationEnabled('test', false)
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.notificationDisabledAccounts).toEqual([])
    })

    test('registers resetState and clearStorage with the store registry', async () => {
        const { useNotificationsStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('notifications-store')

        act(() => {
            useNotificationsStore
                .getState()
                .setAccountNotificationEnabled('test', false)
        })

        act(() => registration.resetState())
        expect(
            useNotificationsStore.getState().notificationDisabledAccounts,
        ).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
