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
import { renderHook, act, waitFor } from '@testing-library/react'
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

describe('services/device/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mocks default return values
        mockCreateDevice.mockResolvedValue({ id: 'new-device-id' })
        mockUpdateDevice.mockResolvedValue({})
    })

    test('useFcmToken exposes fcmToken and setter', async () => {
        vi.resetModules()
        registerTestPlatform()

        const { initDeviceStore } = await import('../../store')
        const { useFcmToken } = await import('../../hooks')

        initDeviceStore()

        const { result } = renderHook(() => useFcmToken())

        act(() => {
            result.current.setFcmToken('OLD_TOKEN')
        })

        expect(result.current.fcmToken).toBe('OLD_TOKEN')

        act(() => {
            result.current.setFcmToken('NEW_TOKEN')
        })

        expect(result.current.fcmToken).toBe('NEW_TOKEN')
    })

    test('useDeviceID returns correct device ID for network', async () => {
        vi.resetModules()
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../../store')
        const { useDeviceID } = await import('../../hooks')

        initDeviceStore()

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

        const { initDeviceStore, useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../../hooks')

        initDeviceStore()

        const { result: store } = renderHook(() => useDeviceStore())

        // Ensure no device ID
        act(() => {
            store.current.setDeviceID('mainnet', null)
            store.current.setFcmToken('test-fcm-token')
        })

        const { result } = renderHook(() => useDevice('mainnet'), {
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

        const { initDeviceStore, useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../../hooks')

        initDeviceStore()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set existing device ID
        act(() => {
            store.current.setDeviceID('mainnet', 'existing-id')
            store.current.setFcmToken('test-fcm-token')
        })

        const { result } = renderHook(() => useDevice('mainnet'), {
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
