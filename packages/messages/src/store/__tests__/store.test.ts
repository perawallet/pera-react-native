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

describe('services/notifications/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('store initializes with defaults', async () => {
        const { useNotificationsStore } = await import('../store')

        const { result } = renderHook(() => useNotificationsStore())

        expect(result.current.notificationDisabledAccounts).toEqual([])
    })

    test('setAccountNotificationEnabled updates account notification state', async () => {
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

    test('resetState reverts to initial values', async () => {
        const { useNotificationsStore } = await import('../store')

        const { result } = renderHook(() => useNotificationsStore())

        act(() => {
            result.current.setAccountNotificationEnabled('test', true)
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.notificationDisabledAccounts).toEqual([])
    })
})
