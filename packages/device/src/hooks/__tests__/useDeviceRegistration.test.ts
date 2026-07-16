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
import { renderHook, waitFor } from '@testing-library/react'

const mockRegisterDevice = vi.fn()
const mockClearDevicePushToken = vi.fn()
const mockUseNetwork = vi.fn()

vi.mock('../useDevice', () => ({
    useDevice: () => ({
        registerDevice: mockRegisterDevice,
        clearDevicePushToken: mockClearDevicePushToken,
        deviceIDs: undefined,
        setDeviceID: vi.fn(),
    }),
}))

// Faithful re-implementation of the real useOnNetworkSwitch (effect-timed,
// fires once per real switch) driven by the same mocked useNetwork.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const { useEffect, useRef } = await import('react')
    return {
        useNetwork: () => mockUseNetwork(),
        useOnNetworkSwitch: (handler: (from: string, to: string) => void) => {
            const { network } = mockUseNetwork()
            const handlerRef = useRef(handler)
            handlerRef.current = handler
            const previousNetworkRef = useRef(network)
            useEffect(() => {
                const previousNetwork = previousNetworkRef.current
                if (previousNetwork === network) return
                previousNetworkRef.current = network
                handlerRef.current(previousNetwork, network)
            }, [network])
        },
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        logger: { warn: vi.fn() },
    }
})

describe('useDeviceRegistration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRegisterDevice.mockResolvedValue(undefined)
        mockClearDevicePushToken.mockResolvedValue(undefined)
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    test('registers device on mount without clearing push token (no prior network)', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const addresses = ['acct-1']
        renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledWith(addresses)
        })
        expect(mockClearDevicePushToken).not.toHaveBeenCalled()
    })

    test('clears previous network push token before re-registering on network switch', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const addresses = ['acct-1']
        const { rerender } = renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        rerender()

        await waitFor(() => {
            expect(mockClearDevicePushToken).toHaveBeenCalledWith('mainnet')
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('does not re-register when a new array carries the same addresses', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ addresses }: { addresses: string[] }) =>
                useDeviceRegistration(addresses),
            { initialProps: { addresses: ['acct-1', 'acct-2'] } },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({ addresses: ['acct-1', 'acct-2'] })

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    test('does not re-register when the same addresses arrive reordered', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ addresses }: { addresses: string[] }) =>
                useDeviceRegistration(addresses),
            { initialProps: { addresses: ['acct-1', 'acct-2'] } },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({ addresses: ['acct-2', 'acct-1'] })

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    test('re-registers when the address set changes', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ addresses }: { addresses: string[] }) =>
                useDeviceRegistration(addresses),
            { initialProps: { addresses: ['acct-1'] } },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({ addresses: ['acct-1', 'acct-2'] })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith([
            'acct-1',
            'acct-2',
        ])
    })

    test('registers with an empty list when no accounts exist', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() => useDeviceRegistration([]))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledWith([])
        })
    })

    test('swallows push-token cleanup failures on network switch', async () => {
        mockClearDevicePushToken.mockRejectedValueOnce(new Error('boom'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(() => useDeviceRegistration(['acct-1']))
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        rerender()

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('swallows registration failures (best-effort)', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('boom'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const addresses = ['acct-1']
        const result = renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalled()
        })

        // Hook never re-throws; the unhandled rejection guard would fire
        // otherwise. The render stays clean.
        expect(result.result.current).toBeUndefined()
    })
})
