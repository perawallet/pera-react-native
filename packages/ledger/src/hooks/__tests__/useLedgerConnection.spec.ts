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

const makeProvider = () => {
    const stop = vi.fn()
    const scan = vi.fn(() => stop)
    const connect = vi.fn()
    const provider: HardwareWalletTransportProvider = {
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
        const { result } = renderHook(() => useLedgerConnection(provider))

        act(() => result.current.startScan())

        expect(result.current.connectionStatus).toBe('scanning')
        expect(result.current.isScanning).toBe(true)

        const [onDevice] = scan.mock.calls[0] as [
            (d: HardwareWalletDevice) => void,
            (err: Error) => void,
        ]

        act(() => {
            onDevice({ id: 'd1', name: 'Nano X' } as HardwareWalletDevice)
            onDevice({ id: 'd1', name: 'Nano X' } as HardwareWalletDevice)
            onDevice({ id: 'd2', name: 'Flex' } as HardwareWalletDevice)
        })

        expect(result.current.devices.map(d => d.id)).toEqual(['d1', 'd2'])
    })

    test('scan error path sets error and stops scanning', () => {
        const { provider, scan } = makeProvider()
        const { result } = renderHook(() => useLedgerConnection(provider))

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
            const { result } = renderHook(() => useLedgerConnection(provider))

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
        const { provider, connect } = makeProvider()
        const transport = makeTransport()
        connect.mockResolvedValue(transport)

        const { result } = renderHook(() => useLedgerConnection(provider))

        let returned: HardwareWalletTransport | undefined
        await act(async () => {
            returned = await result.current.connect('d1')
        })

        expect(returned).toBe(transport)
        expect(result.current.connectionStatus).toBe('connected')
    })

    test('connect propagates errors and leaves status disconnected', async () => {
        const { provider, connect } = makeProvider()
        connect.mockRejectedValue(new Error('connect failed'))

        const { result } = renderHook(() => useLedgerConnection(provider))

        let caught: Error | null = null
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
        const { provider, connect } = makeProvider()
        const transport = makeTransport()
        connect.mockResolvedValue(transport)

        const { result } = renderHook(() => useLedgerConnection(provider))
        await act(async () => {
            await result.current.connect('d1')
        })

        await act(async () => {
            await result.current.disconnect()
        })

        expect(transport.disconnect).toHaveBeenCalled()
        expect(result.current.connectionStatus).toBe('disconnected')
    })
})
