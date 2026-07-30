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

import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

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

        let registrationResult: { createdNew: boolean } | undefined
        await act(async () => {
            registrationResult = await result.current.registerDevice([
                'account-1',
            ])
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
        expect(registrationResult).toEqual({ createdNew: true })
    })

    test('useDevice rejects when the create response carries no id', async () => {
        vi.resetModules()
        mockCreateDevice.mockResolvedValue({})

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

        // Rejecting (instead of storing a null id) keeps the registration on
        // the pending/retry path rather than reporting a healed device.
        await expect(
            result.current.registerDevice(['account-1']),
        ).rejects.toThrow('Device create response carried no id')
        expect(store.current.deviceIDs.get('mainnet') ?? null).toBeNull()
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

        let registrationResult: { createdNew: boolean } | undefined
        await act(async () => {
            registrationResult = await result.current.registerDevice([
                'account-1',
            ])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith({
            deviceId: 'existing-id',
            data: {
                id: 'existing-id',
                accounts: ['account-1'],
                platform: 'ios',
                push_token: 'test-fcm-token',
                model: 'iPhone 14',
                application: 'pera',
                locale: 'en-US',
            },
        })

        expect(mockCreateDevice).not.toHaveBeenCalled()
        expect(registrationResult).toEqual({ createdNew: false })
    })

    // A rotated push token reaches the backend only because writing it changes
    // registerDevice's identity, which useDeviceRegistration lists in the deps
    // of its registering effect. Nothing calls registerDevice on the write, so
    // memoising registerDevice to a stable reference would silently strand
    // every token rotation on the device. Both halves are asserted here.
    test('useDevice re-issues registerDevice when the push token changes, carrying the new token', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', 'existing-id')
            store.current.setPushToken('OLD_TOKEN')
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
        const registerBefore = result.current.registerDevice

        act(() => {
            store.current.setPushToken('NEW_TOKEN')
        })

        expect(result.current.registerDevice).not.toBe(registerBefore)

        await act(async () => {
            await result.current.registerDevice(['account-1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith({
            deviceId: 'existing-id',
            data: expect.objectContaining({ push_token: 'NEW_TOKEN' }),
        })
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

        let registrationResult: { createdNew: boolean } | undefined
        await act(async () => {
            registrationResult = await result.current.registerDevice([
                'account-1',
            ])
        })

        expect(mockUpdateDevice).toHaveBeenCalledTimes(1)
        expect(mockCreateDevice).toHaveBeenCalledTimes(1)
        expect(store.current.deviceIDs.get('mainnet')).toBe('fresh-id')
        expect(registrationResult).toEqual({ createdNew: true })
    })

    test('useDevice falls back to createDevice when updateDevice rejects with a PeraNetworkError 404 (stale id)', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValueOnce(
            new PeraNetworkError('client', { status: 404 }),
        )
        mockCreateDevice.mockResolvedValueOnce({ id: 'fresh-id-2' })

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

        let registrationResult: { createdNew: boolean } | undefined
        await act(async () => {
            registrationResult = await result.current.registerDevice([
                'account-1',
            ])
        })

        expect(mockUpdateDevice).toHaveBeenCalledTimes(1)
        expect(mockCreateDevice).toHaveBeenCalledTimes(1)
        expect(store.current.deviceIDs.get('mainnet')).toBe('fresh-id-2')
        expect(registrationResult).toEqual({ createdNew: true })
    })

    test('useDevice does not retry at the application layer (delegated to ky)', async () => {
        vi.resetModules()

        mockCreateDevice.mockRejectedValue(
            Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
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
        ).rejects.toThrow('timeout')

        // Single attempt at this layer — transient retries belong to ky in the
        // shared query-client. Layering retries here would compound to 6
        // requests (3 outer × 2 inner) per call.
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
                application: 'pera',
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

    test('sends the device id in the PUT body (Pera 6 contract)', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', 'DEV-1')
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
            await result.current.registerDevice(['ADDR'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith({
            deviceId: 'DEV-1',
            data: expect.objectContaining({ id: 'DEV-1', accounts: ['ADDR'] }),
        })
    })

    test('re-creates the device when the update fails with device_already_exists', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValueOnce(
            new PeraNetworkError('client', {
                status: 400,
                backendType: 'device_already_exists',
            }),
        )
        mockCreateDevice.mockResolvedValueOnce({ id: 'DEV-2' })

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', 'DEV-1')
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

        let registrationResult: { createdNew: boolean } | undefined
        await act(async () => {
            registrationResult = await result.current.registerDevice(['ADDR'])
        })

        expect(mockCreateDevice).toHaveBeenCalledOnce()
        expect(store.current.deviceIDs.get('mainnet')).toBe('DEV-2')
        expect(registrationResult).toEqual({ createdNew: true })
    })

    test('still rethrows unrelated client errors without re-creating', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValueOnce(
            new PeraNetworkError('client', { status: 400 }),
        )

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()
        const { result: store } = renderHook(() => useDeviceStore())
        act(() => {
            store.current.setDeviceID('mainnet', 'DEV-1')
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
                await result.current.registerDevice(['ADDR'])
            }),
        ).rejects.toThrow()
        expect(mockCreateDevice).not.toHaveBeenCalled()
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
