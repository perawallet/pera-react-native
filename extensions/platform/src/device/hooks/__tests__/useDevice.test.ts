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
import { registerTestPlatform, createWrapper } from '../../../test-utils'
import { DevicePlatforms } from '../../models'

// Mock mutations
const mockCreateDevice = vi.fn()
const mockUpdateDevice = vi.fn()

vi.mock('../useCreateDeviceMutation', () => ({
    useCreateDeviceMutation: () => ({
        mutateAsync: mockCreateDevice,
    }),
}))

vi.mock('../useUpdateDeviceMutation', () => ({
    useUpdateDeviceMutation: () => ({
        mutateAsync: mockUpdateDevice,
    }),
}))

// Mock device info service
const mockDeviceInfoService = {
    getDevicePlatform: vi.fn().mockResolvedValue(DevicePlatforms.ios),
    getDeviceModel: vi.fn().mockReturnValue('iPhone 14'),
    getDeviceLocale: vi.fn().mockReturnValue('en-US'),
}

vi.mock('../useDeviceInfoService', () => ({
    useDeviceInfoService: () => mockDeviceInfoService,
}))

vi.mock('@perawallet/wallet-extension-network', () => ({
    useNetwork: vi.fn().mockReturnValue({
        network: 'mainnet',
        setNetwork: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

vi.mock('@perawallet/wallet-extension-platform-resources', () => {
    const store = new Map<string, string>()
    return {
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value)
            },
            removeItem: (key: string) => {
                store.delete(key)
            },
            setJSON: (key: string, value: unknown) => {
                store.set(key, JSON.stringify(value))
            },
            getJSON: (key: string) => {
                const v = store.get(key)
                return v ? JSON.parse(v) : null
            },
            getAllKeys: () => [...store.keys()],
        },
    }
})

describe('services/device/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mocks default return values
        mockCreateDevice.mockResolvedValue({ id: 'new-device-id' })
        mockUpdateDevice.mockResolvedValue({})
    })

    test('useFcmToken exposes fcmToken and setter', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { usePushToken } = await import('../../hooks')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => usePushToken())

        act(() => {
            result.current.setPushToken('OLD_TOKEN')
        })

        expect(result.current.pushToken).toBe('OLD_TOKEN')

        act(() => {
            result.current.setPushToken('NEW_TOKEN')
        })

        expect(result.current.pushToken).toBe('NEW_TOKEN')
    })

    test('useDeviceID returns correct device ID for network', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDeviceID } = await import('../../hooks')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set initial state
        act(() => {
            store.current.setDeviceID('mainnet', 'test-id-mainnet')
            store.current.setDeviceID('testnet', 'test-id-testnet')
        })

        const { result: resultMainnet } = renderHook(() =>
            useDeviceID('mainnet'),
        )
        expect(resultMainnet.current).toBe('test-id-mainnet')

        const { result: resultTestnet } = renderHook(() =>
            useDeviceID('testnet'),
        )
        expect(resultTestnet.current).toBe('test-id-testnet')
    })

    test('useDevice registers new device if no ID exists', async () => {
        vi.resetModules()
        registerTestPlatform()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../../hooks')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set device state
        act(() => {
            store.current.setDeviceID('mainnet', null)
            store.current.setPushToken('test-fcm-token')
        })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockCreateDevice).toHaveBeenCalledWith({
            data: {
                accounts: ['account-1'],
                platform: DevicePlatforms.ios,
                push_token: 'test-fcm-token',
                model: 'iPhone 14',
                application: 'pera',
                locale: 'en-US',
            },
        })

        expect(store.current.deviceIDs.get('mainnet')).toBe('new-device-id')
    })

    test('useDevice updates existing device if ID exists', async () => {
        vi.resetModules()
        registerTestPlatform()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../../hooks')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set existing device ID
        act(() => {
            store.current.setDeviceID('mainnet', 'existing-id')
            store.current.setPushToken('test-fcm-token')
        })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith({
            deviceId: 'existing-id',
            data: {
                accounts: ['account-1'],
                platform: DevicePlatforms.ios,
                push_token: 'test-fcm-token',
                model: 'iPhone 14',
                locale: 'en-US',
            },
        })

        expect(mockCreateDevice).not.toHaveBeenCalled()
    })
})
