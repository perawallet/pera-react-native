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

const mockCreateDevice = vi.fn()
const mockUpdateDevice = vi.fn()
const mockNullifyPushToken = vi.fn()

vi.mock('../endpoints', () => ({
    createDevice: (...args: unknown[]) => mockCreateDevice(...args),
    updateDevice: (...args: unknown[]) => mockUpdateDevice(...args),
    nullifyPushToken: (...args: unknown[]) => mockNullifyPushToken(...args),
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
        mockNullifyPushToken.mockResolvedValue(undefined)
    })

    test('registers on new network, switches, and nullifies old push token', async () => {
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

        expect(mockNullifyPushToken).toHaveBeenCalledWith(
            'mainnet',
            'mainnet-device-id',
        )
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
                locale: 'en-US',
            },
        )

        expect(mockCreateDevice).not.toHaveBeenCalled()
        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
    })

    test('does not switch network or nullify token on registration failure', async () => {
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
        expect(mockNullifyPushToken).not.toHaveBeenCalled()
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
        expect(mockNullifyPushToken).not.toHaveBeenCalled()
    })

    test('does not call nullifyPushToken when old network has no device ID', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet', ['ADDR1'])
        })

        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
        expect(mockNullifyPushToken).not.toHaveBeenCalled()
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

    test('logs a warning when nullifying push token on the old network fails', async () => {
        vi.resetModules()
        mockNullifyPushToken.mockRejectedValue(new Error('nullify failed'))

        const { logger } = await import('@perawallet/wallet-core-shared')
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

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

        // Give the fire-and-forget .catch a chance to run
        await new Promise(resolve => setImmediate(resolve))

        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to nullify push token on previous network',
            expect.objectContaining({ error: expect.any(Error) }),
        )
        warnSpy.mockRestore()
    })
})
