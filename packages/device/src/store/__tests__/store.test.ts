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

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.fn()

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

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

describe('device/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('initial state is empty', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.size).toBe(0)
        expect(result.current.pushToken).toBeNull()
    })

    test('setRegistrationPending tracks pending registrations per network', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setRegistrationPending('mainnet', true)
            result.current.setRegistrationPending('testnet', true)
        })
        expect(result.current.pendingRegistrationNetworks).toEqual([
            'mainnet',
            'testnet',
        ])

        act(() => {
            result.current.setRegistrationPending('mainnet', true)
        })
        expect(result.current.pendingRegistrationNetworks).toEqual([
            'mainnet',
            'testnet',
        ])

        act(() => {
            result.current.setRegistrationPending('mainnet', false)
        })
        expect(result.current.pendingRegistrationNetworks).toEqual(['testnet'])
    })

    test('setPushToken stores the token', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setPushToken('test-token-123')
        })

        expect(result.current.pushToken).toBe('test-token-123')
    })

    test('setDeviceID overwrites existing and keeps other networks intact', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'mainnet-1')
            result.current.setDeviceID('testnet', 'testnet-1')
            result.current.setDeviceID('mainnet', 'mainnet-2')
        })

        expect(result.current.deviceIDs.get('mainnet')).toBe('mainnet-2')
        expect(result.current.deviceIDs.get('testnet')).toBe('testnet-1')
    })

    test('setDeviceID produces a new Map reference (immutability)', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        const original = result.current.deviceIDs
        act(() => {
            result.current.setDeviceID('mainnet', 'id')
        })

        expect(result.current.deviceIDs).not.toBe(original)
    })

    test('does not persist pendingRegistrationNetworks', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setRegistrationPending('mainnet', true)
        })

        const { partialize } = useDeviceStore.persist.getOptions()
        const persisted = partialize?.(useDeviceStore.getState())

        expect(persisted).not.toHaveProperty('pendingRegistrationNetworks')
    })

    test('resetState clears pendingRegistrationNetworks', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setRegistrationPending('mainnet', true)
        })

        act(() => useDeviceStore.getState().resetState())

        expect(useDeviceStore.getState().pendingRegistrationNetworks).toEqual(
            [],
        )
    })

    test('registers a resetState and clearStorage callback with the store registry', async () => {
        await import('../index')
        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('device-store')

        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setDeviceID('mainnet', 'id')
            useDeviceStore.getState().setPushToken('tok')
        })

        act(() => registration.resetState())
        expect(useDeviceStore.getState().deviceIDs.size).toBe(0)
        expect(useDeviceStore.getState().pushToken).toBeNull()

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
