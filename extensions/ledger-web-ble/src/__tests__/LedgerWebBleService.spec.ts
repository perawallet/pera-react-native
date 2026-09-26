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

const transportListenMock = vi.hoisted(() => vi.fn())
const transportOpenMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportObserveAvailabilityMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/hw-transport-web-ble', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        isSupported: transportIsSupportedMock,
        observeAvailability: transportObserveAvailabilityMock,
    },
}))

import {
    LedgerAppDriverNotRegisteredError,
    ledgerAppDriverRegistry,
    type HardwareWalletTransport,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import { LedgerWebBleService } from '../LedgerWebBleService'

const openedTransport: HardwareWalletTransport = {
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
    signData: vi.fn(),
    getAppVersion: vi.fn(),
    disconnect: vi.fn(),
}
const driverOpenMock = vi.fn<LedgerAppDriver['open']>(() => openedTransport)
const fakeDriver: LedgerAppDriver = { chainId: 'test', open: driverOpenMock }

const NANO_X_DEVICE = { id: 'ble-device-1', name: 'Nano X ABCD' }
const STAX_DEVICE = { id: 'ble-device-2', name: 'Stax 1234' }

type ScanObserver = {
    next: (event: unknown) => void
    error: (err: unknown) => void
    complete: () => void
}

type AvailabilityObserver = {
    next: (available: boolean) => void
    error: (err: unknown) => void
    complete: () => void
}

const emitScannedDevice = (device: typeof NANO_X_DEVICE = NANO_X_DEVICE) => {
    transportListenMock.mockImplementation((observer: ScanObserver) => {
        observer.next({ type: 'add', descriptor: device })
        observer.complete()
        return { unsubscribe: vi.fn() }
    })
}

const scanAndConnect = async (device: typeof NANO_X_DEVICE = NANO_X_DEVICE) => {
    emitScannedDevice(device)
    const provider = new LedgerWebBleService().createTransportProvider()
    const discovered: { id: string }[] = []
    provider.scan(d => discovered.push(d))
    return provider.connect(discovered[0].id)
}

describe('LedgerWebBleService', () => {
    beforeEach(() => {
        driverOpenMock.mockClear()
        ledgerAppDriverRegistry.reset()
        ledgerAppDriverRegistry.register(fakeDriver)
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportObserveAvailabilityMock.mockReset()
        transportCloseMock.mockReset()
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
    })

    test('declares manufacturer "ledger" and transportType "ble"', () => {
        const provider = new LedgerWebBleService().createTransportProvider()
        expect(provider.manufacturer).toBe('ledger')
        expect(provider.transportType).toBe('ble')
    })

    test('scan emits the single chosen device tagged transportType "ble"', () => {
        emitScannedDevice()
        const onDevice = vi.fn()
        const stop = new LedgerWebBleService()
            .createTransportProvider()
            .scan(onDevice)

        expect(onDevice).toHaveBeenCalledWith({
            id: NANO_X_DEVICE.id,
            name: NANO_X_DEVICE.name,
            manufacturer: 'ledger',
            transportType: 'ble',
            model: 'nanoX',
            rssi: null,
        })

        stop()
    })

    test('scan resolves the model from the device name for Stax', () => {
        emitScannedDevice(STAX_DEVICE)
        const onDevice = vi.fn()
        new LedgerWebBleService().createTransportProvider().scan(onDevice)

        expect(onDevice).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'stax' }),
        )
    })

    test('scan ignores non-"add" events', () => {
        let observer: ScanObserver = {
            next: () => {},
            error: () => {},
            complete: () => {},
        }
        transportListenMock.mockImplementation((subscription: ScanObserver) => {
            observer = subscription
            return { unsubscribe: vi.fn() }
        })

        const onDevice = vi.fn()
        new LedgerWebBleService().createTransportProvider().scan(onDevice)

        observer.next({ type: 'remove', descriptor: NANO_X_DEVICE })
        expect(onDevice).not.toHaveBeenCalled()
    })

    test('scan forwards picker-cancellation errors through classifyLedgerError', () => {
        let observer: ScanObserver = {
            next: () => {},
            error: () => {},
            complete: () => {},
        }
        transportListenMock.mockImplementation((subscription: ScanObserver) => {
            observer = subscription
            return { unsubscribe: vi.fn() }
        })
        const onError = vi.fn()
        new LedgerWebBleService()
            .createTransportProvider()
            .scan(vi.fn(), onError)

        observer.error(new Error('User cancelled the requestDevice() chooser.'))
        expect(onError).toHaveBeenCalled()
    })

    test('connect reopens the scanned BluetoothDevice object (not a fresh picker prompt)', async () => {
        const transport = await scanAndConnect()

        expect(transportOpenMock).toHaveBeenCalledWith(NANO_X_DEVICE)
        expect(typeof transport.getAddress).toBe('function')
        expect(typeof transport.signTransaction).toBe('function')
        expect(typeof transport.disconnect).toBe('function')
    })

    test('connect passes the raw id through when it was not scanned in this session', async () => {
        const provider = new LedgerWebBleService().createTransportProvider()
        await provider.connect('some-other-id')

        expect(transportOpenMock).toHaveBeenCalledWith('some-other-id')
    })

    test('opens the app through the registered driver', async () => {
        const rawTransport = { close: transportCloseMock }
        transportOpenMock.mockResolvedValue(rawTransport)

        const transport = await scanAndConnect()

        expect(driverOpenMock).toHaveBeenCalledWith(rawTransport)
        expect(transport).toBe(openedTransport)
    })

    test('throws before touching the device when no app driver is registered', async () => {
        ledgerAppDriverRegistry.reset()

        await expect(scanAndConnect()).rejects.toBeInstanceOf(
            LedgerAppDriverNotRegisteredError,
        )
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('isSupported delegates to BluetoothTransport.isSupported', async () => {
        transportIsSupportedMock.mockResolvedValue(true)
        const ok = await new LedgerWebBleService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(true)
    })

    test('isSupported returns false if BluetoothTransport.isSupported throws', async () => {
        transportIsSupportedMock.mockImplementation(() => {
            throw new Error('web bluetooth not supported')
        })
        const ok = await new LedgerWebBleService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(false)
    })

    test('observeBluetoothState maps availability true/false to poweredOn/poweredOff', () => {
        let availabilityObserver: AvailabilityObserver = {
            next: () => {},
            error: () => {},
            complete: () => {},
        }
        transportObserveAvailabilityMock.mockImplementation(
            (observer: AvailabilityObserver) => {
                availabilityObserver = observer
                return { unsubscribe: vi.fn() }
            },
        )

        const provider = new LedgerWebBleService().createTransportProvider()
        const onChange = vi.fn()
        provider.observeBluetoothState?.(onChange)

        availabilityObserver.next(true)
        expect(onChange).toHaveBeenLastCalledWith('poweredOn')

        availabilityObserver.next(false)
        expect(onChange).toHaveBeenLastCalledWith('poweredOff')
    })

    test('observeBluetoothState maps an availability error to "unsupported"', () => {
        let availabilityObserver: AvailabilityObserver = {
            next: () => {},
            error: () => {},
            complete: () => {},
        }
        transportObserveAvailabilityMock.mockImplementation(
            (observer: AvailabilityObserver) => {
                availabilityObserver = observer
                return { unsubscribe: vi.fn() }
            },
        )

        const provider = new LedgerWebBleService().createTransportProvider()
        const onChange = vi.fn()
        provider.observeBluetoothState?.(onChange)

        availabilityObserver.error(new Error('web bluetooth not supported'))
        expect(onChange).toHaveBeenCalledWith('unsupported')
    })

    test('requestBluetoothEnable always resolves false (no web equivalent)', async () => {
        const provider = new LedgerWebBleService().createTransportProvider()
        const result = await provider.requestBluetoothEnable?.()
        expect(result).toBe(false)
    })
})
