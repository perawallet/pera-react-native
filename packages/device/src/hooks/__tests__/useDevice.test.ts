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

import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock mutations
const mockCreateDevice = vi.fn()
const mockUpdateDevice = vi.fn()
const mockUpdateDeviceEndpoint = vi.fn()

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

vi.mock('../endpoints', () => ({
    updateDevice: (...args: unknown[]) => mockUpdateDeviceEndpoint(...args),
}))

// Mock device info service via provider
const mockDeviceInfoService = {
    getDevicePlatform: vi.fn().mockResolvedValue('ios'),
    getDeviceModel: vi.fn().mockReturnValue('iPhone 14'),
    getDeviceLocale: vi.fn().mockReturnValue('en-US'),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: mockDeviceInfoService,
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
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

describe('services/device/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mocks default return values
        mockCreateDevice.mockResolvedValue({ id: 'new-device-id' })
        mockUpdateDevice.mockResolvedValue({})
        mockUpdateDeviceEndpoint.mockResolvedValue({ id: 'cleared' })
    })

    test('useFcmToken exposes fcmToken and setter', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { usePushToken } = await import('../usePushToken')

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
        const { useDeviceID } = await import('../useDeviceID')

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

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set device state
        act(() => {
            store.current.setDeviceID('mainnet', null)
            store.current.setPushToken('test-fcm-token')
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), {
            wrapper,
        })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockCreateDevice).toHaveBeenCalledWith({
            data: {
                accounts: ['account-1'],
                platform: 'ios',
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

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        // Set existing device ID
        act(() => {
            store.current.setDeviceID('mainnet', 'existing-id')
            store.current.setPushToken('test-fcm-token')
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), {
            wrapper,
        })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith({
            deviceId: 'existing-id',
            data: {
                accounts: ['account-1'],
                platform: 'ios',
                push_token: 'test-fcm-token',
                model: 'iPhone 14',
                locale: 'en-US',
            },
        })

        expect(mockCreateDevice).not.toHaveBeenCalled()
    })

    test('useDevice falls back to createDevice when updateDevice 404s (stale id)', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValueOnce(
            Object.assign(new Error('Not Found'), {
                response: { status: 404 },
            }),
        )
        mockCreateDevice.mockResolvedValueOnce({ id: 'fresh-id' })

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', 'stale-id')
            store.current.setPushToken('test-fcm-token')
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledTimes(1)
        expect(mockCreateDevice).toHaveBeenCalledTimes(1)
        expect(store.current.deviceIDs.get('mainnet')).toBe('fresh-id')
    })

    test('useDevice retries transient errors and eventually succeeds', async () => {
        vi.resetModules()
        vi.useFakeTimers({ shouldAdvanceTime: true })

        mockCreateDevice
            .mockRejectedValueOnce(
                Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
            )
            .mockResolvedValueOnce({ id: 'eventual-id' })

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', null)
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockCreateDevice).toHaveBeenCalledTimes(2)
        expect(store.current.deviceIDs.get('mainnet')).toBe('eventual-id')

        vi.useRealTimers()
    })

    test('useDevice does not retry non-transient errors', async () => {
        vi.resetModules()

        mockCreateDevice.mockRejectedValue(
            Object.assign(new Error('forbidden'), {
                response: { status: 403 },
            }),
        )

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', null)
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await expect(
            act(async () => {
                await result.current.registerDevice(['account-1'])
            }),
        ).rejects.toThrow('forbidden')

        expect(mockCreateDevice).toHaveBeenCalledTimes(1)
    })

    test('clearDevicePushToken targets the previous network directly with push_token: "" and empty accounts', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('testnet', 'testnet-device-id')
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setPushToken('test-fcm-token')
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await act(async () => {
            await result.current.clearDevicePushToken('testnet')
        })

        // Routed via the raw endpoint with the *target* network, not the
        // mutation hook (which captures the current network). `accounts` is
        // sent empty so the new network's address list can't accidentally
        // overwrite the old device record.
        expect(mockUpdateDeviceEndpoint).toHaveBeenCalledWith(
            'testnet',
            'testnet-device-id',
            {
                accounts: [],
                platform: 'ios',
                push_token: '',
                model: 'iPhone 14',
                locale: 'en-US',
            },
        )
        expect(mockUpdateDevice).not.toHaveBeenCalled()
    })

    test('clearDevicePushToken is a no-op when target network has no device ID', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await act(async () => {
            await result.current.clearDevicePushToken('testnet')
        })

        expect(mockUpdateDeviceEndpoint).not.toHaveBeenCalled()
    })

    test('clearDevicePushToken swallows endpoint failures (best-effort)', async () => {
        vi.resetModules()
        mockUpdateDeviceEndpoint.mockRejectedValueOnce(
            Object.assign(new Error('Not Found'), {
                response: { status: 404 },
            }),
        )

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('testnet', 'stale-id')
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => useDevice(), { wrapper })

        await expect(
            act(async () => {
                await result.current.clearDevicePushToken('testnet')
            }),
        ).resolves.not.toThrow()
    })
})
