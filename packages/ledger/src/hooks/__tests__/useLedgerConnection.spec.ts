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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLedgerConnection } from '../useLedgerConnection'
import type {
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
    HardwareWalletDevice,
} from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'

const makeProvider = () => {
    const stop = vi.fn()
    const scan = vi.fn(() => stop)
    const connect = vi.fn()
    const provider: HardwareWalletTransportProvider = {
        manufacturer: 'ledger' as const,
        transportType: 'ble' as const,
        scan,
        connect,
    } as unknown as HardwareWalletTransportProvider
    return { provider, scan, stop, connect }
}

const makeTransport = (): HardwareWalletTransport =>
    ({
        disconnect: vi.fn().mockResolvedValue(undefined),
    }) as unknown as HardwareWalletTransport

describe('useLedgerConnection', () => {
    test('startScan transitions to scanning and accumulates unique devices', () => {
        const { provider, scan } = makeProvider()
        const { result } = renderHook(() => useLedgerConnection([provider]))

        act(() => result.current.startScan())

        expect(result.current.connectionStatus).toBe('scanning')
        expect(result.current.isScanning).toBe(true)

        const [onDevice] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]

        act(() => {
            onDevice({
                id: 'd1',
                name: 'Nano X',
                transportType: 'ble',
            } as HardwareWalletDevice)
            onDevice({
                id: 'd1',
                name: 'Nano X',
                transportType: 'ble',
            } as HardwareWalletDevice)
            onDevice({
                id: 'd2',
                name: 'Flex',
                transportType: 'ble',
            } as HardwareWalletDevice)
        })

        expect(result.current.devices.map(d => d.id)).toEqual(['d1', 'd2'])
    })

    test('scan error path sets error and stops scanning', () => {
        const { provider, scan } = makeProvider()
        const { result } = renderHook(() => useLedgerConnection([provider]))

        act(() => result.current.startScan())
        const [, onError] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]

        act(() => onError(new Error('ble unavailable')))

        expect(result.current.error?.message).toBe('ble unavailable')
        expect(result.current.isScanning).toBe(false)
    })

    test('scan timeout stops the scan automatically', () => {
        vi.useFakeTimers()
        try {
            const { provider, stop } = makeProvider()
            const { result } = renderHook(() =>
                useLedgerConnection([provider]),
            )

            act(() => result.current.startScan())
            act(() => {
                vi.advanceTimersByTime(30_000)
            })

            expect(stop).toHaveBeenCalled()
            expect(result.current.isScanning).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    })

    test('connect sets connected status and returns transport', async () => {
        const { provider, scan, connect } = makeProvider()
        const transport = makeTransport()
        connect.mockResolvedValue(transport)

        const { result } = renderHook(() => useLedgerConnection([provider]))

        act(() => result.current.startScan())
        const [onDevice] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]
        act(() => {
            onDevice({
                id: 'd1',
                name: 'Nano X',
                transportType: 'ble',
            } as HardwareWalletDevice)
        })

        let returned: HardwareWalletTransport | undefined
        await act(async () => {
            returned = await result.current.connect('d1')
        })

        expect(returned).toBe(transport)
        expect(result.current.connectionStatus).toBe('connected')
    })

    test('connect propagates errors and leaves status disconnected', async () => {
        const { provider, scan, connect } = makeProvider()
        connect.mockRejectedValue(new Error('connect failed'))

        const { result } = renderHook(() => useLedgerConnection([provider]))

        act(() => result.current.startScan())
        const [onDevice] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]
        act(() => {
            onDevice({
                id: 'd1',
                name: 'Nano X',
                transportType: 'ble',
            } as HardwareWalletDevice)
        })

        let caught: Nullable<Error> = null
        await act(async () => {
            try {
                await result.current.connect('d1')
            } catch (err) {
                caught = err as Error
            }
        })

        expect(caught?.message).toBe('connect failed')
        expect(result.current.error?.message).toBe('connect failed')
        expect(result.current.connectionStatus).toBe('disconnected')
    })

    test('disconnect calls transport.disconnect and clears status', async () => {
        const { provider, scan, connect } = makeProvider()
        const transport = makeTransport()
        connect.mockResolvedValue(transport)

        const { result } = renderHook(() => useLedgerConnection([provider]))

        act(() => result.current.startScan())
        const [onDevice] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]
        act(() => {
            onDevice({
                id: 'd1',
                name: 'Nano X',
                transportType: 'ble',
            } as HardwareWalletDevice)
        })

        await act(async () => {
            await result.current.connect('d1')
        })

        await act(async () => {
            await result.current.disconnect()
        })

        expect(transport.disconnect).toHaveBeenCalled()
        expect(result.current.connectionStatus).toBe('disconnected')
    })

    test('merges devices from BLE and USB providers into one list', () => {
        let bleObserver: { next: (e: unknown) => void } = { next: () => {} }
        let usbObserver: { next: (e: unknown) => void } = { next: () => {} }

        const bleProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'ble' as const,
            scan: vi.fn((onDevice, _onError) => {
                bleObserver = { next: onDevice as (e: unknown) => void }
                return () => {}
            }),
            connect: vi.fn(),
            isSupported: async () => true,
        }
        const usbProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'usb' as const,
            scan: vi.fn((onDevice, _onError) => {
                usbObserver = { next: onDevice as (e: unknown) => void }
                return () => {}
            }),
            connect: vi.fn(),
            isSupported: async () => true,
        }

        const { result } = renderHook(() =>
            useLedgerConnection([bleProvider, usbProvider]),
        )
        act(() => result.current.startScan())

        act(() => {
            bleObserver.next({
                id: 'b1',
                name: 'Nano X',
                manufacturer: 'ledger',
                transportType: 'ble',
                model: 'nanoX',
                rssi: -50,
            })
        })
        act(() => {
            usbObserver.next({
                id: 'u1',
                name: 'Nano S Plus',
                manufacturer: 'ledger',
                transportType: 'usb',
                model: 'nanoSPlus',
                rssi: null,
            })
        })

        expect(result.current.devices).toHaveLength(2)
        expect(result.current.devices.map(d => d.transportType).sort()).toEqual(
            ['ble', 'usb'],
        )
    })

    test('connect routes to the provider that emitted the device', async () => {
        let bleOnDevice: (d: unknown) => void = () => {}
        const bleProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'ble' as const,
            scan: vi.fn(onDevice => {
                bleOnDevice = onDevice as (d: unknown) => void
                return () => {}
            }),
            connect: vi.fn().mockResolvedValue({
                getAddress: vi.fn(),
                signTransaction: vi.fn(),
                disconnect: vi.fn(),
            }),
            isSupported: async () => true,
        }
        const usbProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'usb' as const,
            scan: vi.fn(() => () => {}),
            connect: vi.fn(),
            isSupported: async () => true,
        }

        const { result } = renderHook(() =>
            useLedgerConnection([bleProvider, usbProvider]),
        )
        act(() => result.current.startScan())
        act(() => {
            bleOnDevice({
                id: 'b1',
                name: 'Nano X',
                manufacturer: 'ledger',
                transportType: 'ble',
                model: 'nanoX',
                rssi: -50,
            })
        })

        await act(async () => {
            await result.current.connect('b1')
        })

        expect(bleProvider.connect).toHaveBeenCalledWith('b1')
        expect(usbProvider.connect).not.toHaveBeenCalled()
    })

    test('connect rejects when the device id has not been seen by any provider', async () => {
        const provider = {
            manufacturer: 'ledger' as const,
            transportType: 'ble' as const,
            scan: vi.fn(() => () => {}),
            connect: vi.fn(),
            isSupported: async () => true,
        }
        const { result } = renderHook(() => useLedgerConnection([provider]))

        await expect(result.current.connect('unknown')).rejects.toThrow(
            /No provider tracked/,
        )
    })
})
