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
const transportListMock = vi.hoisted(() => vi.fn())
const transportOpenMock = vi.hoisted(() => vi.fn())
const transportRequestMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())
// Constructable (not just a plain object with static methods) so the
// "device already open" path — which bypasses TransportWebHID.open() and
// calls `new TransportWebHID(device)` directly — has something real to
// construct. Returning an object from the mock constructor makes `new
// TransportWebHIDMock(device)` yield that object, same as any JS class.
const TransportWebHIDMock = vi.hoisted(() =>
    // Arrow functions can never be constructors — `new TransportWebHIDMock()`
    // requires a plain `function` expression here.
    vi.fn(function TransportWebHIDMock() {
        return { close: transportCloseMock }
    }),
)

vi.mock('@ledgerhq/hw-transport-webhid', () => {
    Object.assign(TransportWebHIDMock, {
        listen: transportListenMock,
        list: transportListMock,
        open: transportOpenMock,
        request: transportRequestMock,
        isSupported: transportIsSupportedMock,
    })
    return { default: TransportWebHIDMock }
})

import {
    LedgerAppDriverNotRegisteredError,
    ledgerAppDriverRegistry,
    type HardwareWalletTransport,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import { LedgerWebUsbService } from '../LedgerWebUsbService'

const openedTransport: HardwareWalletTransport = {
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
    signData: vi.fn(),
    getAppVersion: vi.fn(),
    disconnect: vi.fn(),
}
const driverOpenMock = vi.fn<LedgerAppDriver['open']>(() => openedTransport)
const fakeDriver: LedgerAppDriver = { chainId: 'test', open: driverOpenMock }

const NANO_S_PLUS_DEVICE = {
    vendorId: 0x2c_97,
    productId: 0x40_11,
    productName: 'Nano S Plus',
}

type ScanObserver = {
    next: (event: unknown) => void
    error: (err: unknown) => void
    complete: () => void
}

const emitScannedDevice = (
    device: typeof NANO_S_PLUS_DEVICE = NANO_S_PLUS_DEVICE,
) => {
    transportListenMock.mockImplementation((observer: ScanObserver) => {
        observer.next({ type: 'add', descriptor: device })
        observer.complete()
        return { unsubscribe: vi.fn() }
    })
}

const scanAndConnect = async (
    device: typeof NANO_S_PLUS_DEVICE = NANO_S_PLUS_DEVICE,
) => {
    emitScannedDevice(device)
    const provider = new LedgerWebUsbService().createTransportProvider()
    const discovered: { id: string }[] = []
    provider.scan(d => discovered.push(d))
    return provider.connect(discovered[0].id)
}

describe('LedgerWebUsbService', () => {
    beforeEach(() => {
        driverOpenMock.mockClear()
        ledgerAppDriverRegistry.reset()
        ledgerAppDriverRegistry.register(fakeDriver)
        transportListenMock.mockReset()
        transportListMock.mockReset()
        transportOpenMock.mockReset()
        transportRequestMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        TransportWebHIDMock.mockClear()
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
        transportRequestMock.mockResolvedValue({ close: transportCloseMock })
        transportListMock.mockResolvedValue([])
    })

    test('declares manufacturer "ledger" and transportType "usb"', () => {
        const provider = new LedgerWebUsbService().createTransportProvider()
        expect(provider.manufacturer).toBe('ledger')
        expect(provider.transportType).toBe('usb')
    })

    test('scan emits an "add" device tagged transportType "usb" with a synthesized vendorId:productId id', () => {
        emitScannedDevice()
        const onDevice = vi.fn()
        const stop = new LedgerWebUsbService()
            .createTransportProvider()
            .scan(onDevice)

        expect(onDevice).toHaveBeenCalledWith({
            id: `${NANO_S_PLUS_DEVICE.vendorId}:${NANO_S_PLUS_DEVICE.productId}`,
            name: 'Nano S Plus',
            manufacturer: 'ledger',
            transportType: 'usb',
            model: 'nanoSPlus',
            rssi: null,
        })

        stop()
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
        new LedgerWebUsbService().createTransportProvider().scan(onDevice)

        observer.next({ type: 'remove', descriptor: NANO_S_PLUS_DEVICE })
        expect(onDevice).not.toHaveBeenCalled()
    })

    test('scan forwards listen errors through classifyLedgerError', () => {
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
        new LedgerWebUsbService()
            .createTransportProvider()
            .scan(vi.fn(), onError)

        observer.error({ message: 'Access denied to use Ledger device' })
        expect(onError).toHaveBeenCalled()
    })

    test('connect opens the previously-scanned HIDDevice object (not a re-prompt)', async () => {
        const transport = await scanAndConnect()

        expect(transportOpenMock).toHaveBeenCalledWith(NANO_S_PLUS_DEVICE)
        expect(transportRequestMock).not.toHaveBeenCalled()
        expect(typeof transport.getAddress).toBe('function')
        expect(typeof transport.signTransaction).toBe('function')
        expect(typeof transport.disconnect).toBe('function')
    })

    test('connect reuses an already-open cached device instead of calling open() again (avoids "device already open")', async () => {
        // A transport from an earlier screen (e.g. LedgerFetchAccountsScreen)
        // may not have closed cleanly before this screen reconnects the same
        // cached device — TransportWebHID.open() throws "InvalidStateError:
        // The device is already open" in that case.
        const alreadyOpenDevice = { ...NANO_S_PLUS_DEVICE, opened: true }
        const transport = await scanAndConnect(alreadyOpenDevice)

        expect(TransportWebHIDMock).toHaveBeenCalledWith(alreadyOpenDevice)
        expect(transportOpenMock).not.toHaveBeenCalled()
        expect(typeof transport.disconnect).toBe('function')
    })

    // The approval window (approval.html) is its own document, so it gets a
    // fresh service whose scan cache is empty — nothing scans there. Falling
    // straight through to request() asks for a user gesture the signing
    // pipeline no longer has by the time it reaches connect(), so signing
    // died with no device prompt. Already-permitted devices must come back
    // from getDevices() (TransportWebHID.list), which needs no gesture.
    test('connect re-resolves an already-permitted device via list() when nothing was scanned in this document', async () => {
        const provider = new LedgerWebUsbService().createTransportProvider()
        transportListMock.mockResolvedValue([NANO_S_PLUS_DEVICE])

        const transport = await provider.connect(
            `${NANO_S_PLUS_DEVICE.vendorId}:${NANO_S_PLUS_DEVICE.productId}`,
        )

        expect(transportOpenMock).toHaveBeenCalledWith(NANO_S_PLUS_DEVICE)
        expect(transportRequestMock).not.toHaveBeenCalled()
        expect(typeof transport.signTransaction).toBe('function')
    })

    test('connect reuses an already-open permitted device rather than reopening it', async () => {
        const alreadyOpenDevice = { ...NANO_S_PLUS_DEVICE, opened: true }
        const provider = new LedgerWebUsbService().createTransportProvider()
        transportListMock.mockResolvedValue([alreadyOpenDevice])

        await provider.connect(
            `${NANO_S_PLUS_DEVICE.vendorId}:${NANO_S_PLUS_DEVICE.productId}`,
        )

        expect(TransportWebHIDMock).toHaveBeenCalledWith(alreadyOpenDevice)
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('connect falls back to request() (shows the device picker) when the id is not among the permitted devices', async () => {
        const provider = new LedgerWebUsbService().createTransportProvider()
        transportListMock.mockResolvedValue([NANO_S_PLUS_DEVICE])

        await provider.connect('9999:9999')

        expect(transportRequestMock).toHaveBeenCalled()
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('connect still falls back to request() when list() is unavailable', async () => {
        const provider = new LedgerWebUsbService().createTransportProvider()
        transportListMock.mockRejectedValue(
            new Error('navigator.hid is not supported'),
        )

        await provider.connect('unknown-id')

        expect(transportRequestMock).toHaveBeenCalled()
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
        expect(transportListMock).not.toHaveBeenCalled()
        expect(transportOpenMock).not.toHaveBeenCalled()
        expect(transportRequestMock).not.toHaveBeenCalled()
    })

    test('isSupported delegates to TransportWebHID.isSupported', async () => {
        transportIsSupportedMock.mockResolvedValue(true)
        const ok = await new LedgerWebUsbService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(true)
    })

    test('isSupported returns false if TransportWebHID.isSupported throws', async () => {
        transportIsSupportedMock.mockImplementation(() => {
            throw new Error('navigator.hid is not supported')
        })
        const ok = await new LedgerWebUsbService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(false)
    })
})
