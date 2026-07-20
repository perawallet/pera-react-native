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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { onlineManager, focusManager } from '@tanstack/react-query'

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
    beforeEach(async () => {
        vi.clearAllMocks()
        mockRegisterDevice.mockResolvedValue({ createdNew: false })
        mockClearDevicePushToken.mockResolvedValue(undefined)
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        onlineManager.setOnline(true)
        const { useDeviceStore } = await import('../../store')
        useDeviceStore.getState().resetState()
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        focusManager.setFocused(undefined)
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

    test('retries a failed registration when connectivity returns', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('offline'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const addresses = ['acct-1']
        renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toEqual([])
        })
    })

    test('retries a failed registration when the app is foregrounded', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('degraded link'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const addresses = ['acct-1']
        renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })

        act(() => focusManager.setFocused(false))
        act(() => focusManager.setFocused(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('suppresses reconnect retry while a mount registration is in flight', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('first attempt'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        let addresses = ['acct-1']
        const { rerender } = renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })

        // Account-set change fires a second mount registration that hangs.
        let resolveHanging = () => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<{ createdNew: boolean }>(resolve => {
                    resolveHanging = () => resolve({ createdNew: false })
                }),
        )
        addresses = ['acct-1', 'acct-2']
        rerender()
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })

        // A reconnect edge during the in-flight attempt must not stack a third.
        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))
        expect(mockRegisterDevice).toHaveBeenCalledTimes(2)

        act(() => resolveHanging())
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toEqual([])
        })
    })

    test('does not re-register on reconnect once registration succeeded', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const addresses = ['acct-1']
        renderHook(() => useDeviceRegistration(addresses))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    test('retries with the same sorted address list the mount path registers', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('offline'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        renderHook(() => useDeviceRegistration(['acct-2', 'acct-1']))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith([
            'acct-1',
            'acct-2',
        ])

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith([
            'acct-1',
            'acct-2',
        ])
    })

    test('ignores a stale success settling after a newer attempt failed', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        let resolveFirst = () => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<{ createdNew: boolean }>(resolve => {
                    resolveFirst = () => resolve({ createdNew: false })
                }),
        )

        const { rerender } = renderHook(
            ({ addresses }: { addresses: string[] }) =>
                useDeviceRegistration(addresses),
            { initialProps: { addresses: ['acct-1'] } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        // Account-set change: the newer attempt fails and marks pending.
        mockRegisterDevice.mockRejectedValueOnce(new Error('newer failed'))
        rerender({ addresses: ['acct-1', 'acct-2'] })
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })

        // The stale first attempt settles late — it must not mark the newer
        // failure as healed.
        await act(async () => resolveFirst())
        expect(useDeviceStore.getState().pendingRegistrationNetworks).toContain(
            'mainnet',
        )
    })

    test('a stale settle does not release the lock a newer attempt owns', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('first failed'))
        let rejectSecond = (_reason?: unknown) => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<void>((_resolve, reject) => {
                    rejectSecond = reject
                }),
        )
        mockRegisterDevice.mockImplementationOnce(() => new Promise(() => {}))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        const { rerender } = renderHook(
            ({ addresses }: { addresses: string[] }) =>
                useDeviceRegistration(addresses),
            { initialProps: { addresses: ['acct-1'] } },
        )
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationNetworks,
            ).toContain('mainnet')
        })

        // Two further attempts: #2 hangs, then #3 starts and owns the lock.
        rerender({ addresses: ['acct-1', 'acct-2'] })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        rerender({ addresses: ['acct-1', 'acct-2', 'acct-3'] })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(3)
        })

        // #2 settles late; its finally must not release #3's lock, so a
        // reconnect edge cannot stack a retry on the in-flight attempt.
        await act(async () => rejectSecond(new Error('stale failure')))
        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))
        expect(mockRegisterDevice).toHaveBeenCalledTimes(3)
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

    test('invokes onDeviceCreated when registration created a new device', async () => {
        mockRegisterDevice.mockResolvedValue({ createdNew: true })
        const onDeviceCreated = vi.fn()

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() => useDeviceRegistration(['ADDR'], { onDeviceCreated }))
        await waitFor(() =>
            expect(onDeviceCreated).toHaveBeenCalledWith('mainnet'),
        )
    })

    test('does not invoke onDeviceCreated on a plain update', async () => {
        mockRegisterDevice.mockResolvedValue({ createdNew: false })
        const onDeviceCreated = vi.fn()

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() => useDeviceRegistration(['ADDR'], { onDeviceCreated }))
        await waitFor(() => expect(mockRegisterDevice).toHaveBeenCalled())
        expect(onDeviceCreated).not.toHaveBeenCalled()
    })
})
