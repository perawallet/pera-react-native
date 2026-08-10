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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { LedgerScanTimeoutError } from '@perawallet/wallet-extension-ledger-shared'
import { useLedgerConnection } from '../useLedgerConnection'
import type {
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
    HardwareWalletDevice,
} from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

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

        expect(result.current.error?.message).toMatch(/ble unavailable/)
        expect(result.current.isScanning).toBe(false)
    })

    test('scan timeout with no device found stops the scan and surfaces a timeout error', () => {
        // The silent variant of this state left the screen faking "searching"
        // forever — the timeout must surface as a readable, retryable error.
        vi.useFakeTimers()
        try {
            const { provider, stop } = makeProvider()
            const { result } = renderHook(() => useLedgerConnection([provider]))

            act(() => result.current.startScan())
            act(() => {
                vi.advanceTimersByTime(30_000)
            })

            expect(stop).toHaveBeenCalled()
            expect(result.current.isScanning).toBe(false)
            expect(result.current.error).toBeInstanceOf(LedgerScanTimeoutError)
        } finally {
            vi.useRealTimers()
        }
    })

    test('scan timeout after a device was found stops the scan without an error', () => {
        // A populated device list is a successful scan — timing out the
        // subscription must not swap the list for an error state.
        vi.useFakeTimers()
        try {
            const { provider, scan, stop } = makeProvider()
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
            act(() => {
                vi.advanceTimersByTime(30_000)
            })

            expect(stop).toHaveBeenCalled()
            expect(result.current.error).toBeNull()
            expect(result.current.devices.map(d => d.id)).toEqual(['d1'])
        } finally {
            vi.useRealTimers()
        }
    })

    test('startScan while a scan is active tears down the previous scan first', () => {
        // Re-entrancy: without stop-before-start, the first scan's
        // subscriptions leak and its still-armed timeout kills the new scan
        // early.
        vi.useFakeTimers()
        try {
            const stops = [vi.fn(), vi.fn()]
            let call = 0
            const scan = vi.fn(() => stops[call++])
            const provider = {
                manufacturer: 'ledger' as const,
                transportType: 'ble' as const,
                scan,
                connect: vi.fn(),
            } as unknown as HardwareWalletTransportProvider
            const { result } = renderHook(() => useLedgerConnection([provider]))

            act(() => result.current.startScan())
            act(() => {
                vi.advanceTimersByTime(15_000)
            })
            act(() => result.current.startScan())

            // The first scan's subscription was released...
            expect(stops[0]).toHaveBeenCalled()
            expect(stops[1]).not.toHaveBeenCalled()
            expect(result.current.isScanning).toBe(true)

            // ...and its timer no longer points at the new scan: only the
            // full fresh budget stops scan #2.
            act(() => {
                vi.advanceTimersByTime(16_000)
            })
            expect(result.current.isScanning).toBe(true)
            act(() => {
                vi.advanceTimersByTime(15_000)
            })
            expect(result.current.isScanning).toBe(false)
            expect(stops[1]).toHaveBeenCalled()
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
        const device: HardwareWalletDevice = {
            id: 'd1',
            name: 'Nano X',
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: null,
        }
        act(() => onDevice(device))

        let returned: Optional<HardwareWalletTransport>
        await act(async () => {
            returned = await result.current.connect(device)
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
        const device: HardwareWalletDevice = {
            id: 'd1',
            name: 'Nano X',
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: null,
        }
        act(() => onDevice(device))

        let caught: Nullable<Error> = null
        await act(async () => {
            try {
                await result.current.connect(device)
            } catch (err) {
                caught = err as Error
            }
        })

        expect(caught?.message).toMatch(/connect failed/)
        expect(result.current.error?.message).toMatch(/connect failed/)
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
        const device: HardwareWalletDevice = {
            id: 'd1',
            name: 'Nano X',
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: null,
        }
        act(() => onDevice(device))

        await act(async () => {
            await result.current.connect(device)
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
        const bleDevice: HardwareWalletDevice = {
            id: 'b1',
            name: 'Nano X',
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: -50,
        }
        act(() => bleOnDevice(bleDevice))

        await act(async () => {
            await result.current.connect(bleDevice)
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

        await expect(
            result.current.connect({
                id: 'unknown',
                name: 'Nano X',
                manufacturer: 'ledger',
                transportType: 'ble',
                model: 'nanoX',
                rssi: null,
            }),
        ).rejects.toThrow(/No provider tracked/)
    })

    test('connect routes to the correct transport when devices share an id across providers', async () => {
        let bleOnDevice: (d: unknown) => void = () => {}
        let usbOnDevice: (d: unknown) => void = () => {}
        const bleTransport = makeTransport()
        const usbTransport = makeTransport()
        const bleProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'ble' as const,
            scan: vi.fn(onDevice => {
                bleOnDevice = onDevice as (d: unknown) => void
                return () => {}
            }),
            connect: vi.fn().mockResolvedValue(bleTransport),
            isSupported: async () => true,
        }
        const usbProvider = {
            manufacturer: 'ledger' as const,
            transportType: 'usb' as const,
            scan: vi.fn(onDevice => {
                usbOnDevice = onDevice as (d: unknown) => void
                return () => {}
            }),
            connect: vi.fn().mockResolvedValue(usbTransport),
            isSupported: async () => true,
        }

        const { result } = renderHook(() =>
            useLedgerConnection([bleProvider, usbProvider]),
        )
        act(() => result.current.startScan())

        const bleDevice: HardwareWalletDevice = {
            id: 'shared',
            name: 'Nano BLE',
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: -50,
        }
        const usbDevice: HardwareWalletDevice = {
            id: 'shared',
            name: 'Nano USB',
            manufacturer: 'ledger',
            transportType: 'usb',
            model: 'nanoX',
            rssi: null,
        }

        act(() => {
            bleOnDevice(bleDevice)
            usbOnDevice(usbDevice)
        })

        await act(async () => {
            await result.current.connect(bleDevice)
        })

        expect(bleProvider.connect).toHaveBeenCalledWith('shared')
        expect(usbProvider.connect).not.toHaveBeenCalled()
    })
})
