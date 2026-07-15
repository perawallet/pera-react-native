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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

const mockCreateDevice = vi.fn()
const mockUpdateDevice = vi.fn()

vi.mock('../endpoints', () => ({
    createDevice: (...args: unknown[]) => mockCreateDevice(...args),
    updateDevice: (...args: unknown[]) => mockUpdateDevice(...args),
}))

const mockSetNetwork = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({
        network: 'mainnet',
    }),
    useNetworkStore: vi.fn(selector => {
        const state = { setNetwork: mockSetNetwork }
        return selector(state)
    }),
}))

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

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
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

describe('useSwitchNetwork', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateDevice.mockResolvedValue({ id: 'new-testnet-device-id' })
        mockUpdateDevice.mockResolvedValue({})
    })

    test("registers on new network and switches (clearing the old token is RootComponent's job)", async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setPushToken('fcm-token')
        })

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockCreateDevice).toHaveBeenCalledWith('testnet', {
            accounts: ['ADDR1'],
            platform: 'ios',
            push_token: 'fcm-token',
            model: 'iPhone 14',
            application: 'pera',
            locale: 'en-US',
        })

        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')

        expect(store.current.deviceIDs.get('testnet')).toBe(
            'new-testnet-device-id',
        )

        // The "clear push token on previous network" responsibility now lives
        // in RootComponent's network-change effect (clearDevicePushToken),
        // which fires reactively to setNetwork(). useSwitchNetwork no longer
        // duplicates that call.
    })

    test('updates existing device on new network if device ID exists', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setDeviceID('testnet', 'existing-testnet-id')
            store.current.setPushToken('fcm-token')
        })

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalledWith(
            'testnet',
            'existing-testnet-id',
            {
                accounts: ['ADDR1'],
                platform: 'ios',
                push_token: 'fcm-token',
                model: 'iPhone 14',
                application: 'pera',
                locale: 'en-US',
            },
        )

        expect(mockCreateDevice).not.toHaveBeenCalled()
        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
    })

    test('re-registers and switches when updating a stale device ID 404s', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValue({ response: { status: 404 } })

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setDeviceID('testnet', 'stale-testnet-id')
            store.current.setPushToken('fcm-token')
        })

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalled()
        expect(mockCreateDevice).toHaveBeenCalledWith('testnet', {
            accounts: ['ADDR1'],
            platform: 'ios',
            push_token: 'fcm-token',
            model: 'iPhone 14',
            application: 'pera',
            locale: 'en-US',
        })
        expect(store.current.deviceIDs.get('testnet')).toBe(
            'new-testnet-device-id',
        )
        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
    })

    test('re-registers and switches when updating a stale device ID rejects with a PeraNetworkError 404', async () => {
        vi.resetModules()
        mockUpdateDevice.mockRejectedValue(
            new PeraNetworkError('client', { status: 404 }),
        )

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setDeviceID('testnet', 'stale-testnet-id')
            store.current.setPushToken('fcm-token')
        })

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockUpdateDevice).toHaveBeenCalled()
        expect(mockCreateDevice).toHaveBeenCalledWith('testnet', {
            accounts: ['ADDR1'],
            platform: 'ios',
            push_token: 'fcm-token',
            model: 'iPhone 14',
            application: 'pera',
            locale: 'en-US',
        })
        expect(store.current.deviceIDs.get('testnet')).toBe(
            'new-testnet-device-id',
        )
        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
    })

    test('does not switch network on registration failure', async () => {
        vi.resetModules()
        mockCreateDevice.mockRejectedValue(new Error('Network error'))

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'mainnet-device-id')
            store.current.setPushToken('fcm-token')
        })

        const { result } = renderHook(() => useSwitchNetwork())

        await expect(
            act(async () => {
                await result.current.switchNetwork('testnet', ['ADDR1'])
            }),
        ).rejects.toThrow('Network error')

        expect(mockSetNetwork).not.toHaveBeenCalled()
    })

    test('no-ops when switching to same network', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('mainnet', ['ADDR1'])
        })

        expect(mockCreateDevice).not.toHaveBeenCalled()
        expect(mockUpdateDevice).not.toHaveBeenCalled()
        expect(mockSetNetwork).not.toHaveBeenCalled()
    })

    test('switches network even when old network has no device ID', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
    })

    test('isSwitching is true while switch is in progress', async () => {
        vi.resetModules()

        let resolveCreate: (value: { id: string }) => void
        mockCreateDevice.mockReturnValue(
            new Promise(resolve => {
                resolveCreate = resolve
            }),
        )

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useSwitchNetwork())

        expect(result.current.isSwitching).toBe(false)

        let switchPromise: Promise<void>
        act(() => {
            switchPromise = result.current.switchNetwork('testnet', ['ADDR1'])
        })

        // isSwitching should be true while the create is pending
        expect(result.current.isSwitching).toBe(true)

        await act(async () => {
            resolveCreate!({ id: 'new-id' })
            await switchPromise
        })

        expect(result.current.isSwitching).toBe(false)
    })

    test('isSwitching resets to false on failure', async () => {
        vi.resetModules()
        mockCreateDevice.mockRejectedValue(new Error('fail'))

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useSwitchNetwork())

        try {
            await act(async () => {
                await result.current.switchNetwork('testnet', ['ADDR1'])
            })
        } catch {
            // expected
        }

        expect(result.current.isSwitching).toBe(false)
    })
})
