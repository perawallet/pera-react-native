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
const transportListMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/react-native-hid', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        list: transportListMock,
        isSupported: transportIsSupportedMock,
    },
}))

import {
    LedgerAppDriverNotRegisteredError,
    ledgerAppDriverRegistry,
    type HardwareWalletTransport,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import { RNLedgerUsbService } from '../RNLedgerUsbService'
import {
    LedgerUsbMultipleDevicesError,
    LedgerUsbNoDeviceError,
} from '@perawallet/wallet-extension-ledger-shared'

const openedTransport: HardwareWalletTransport = {
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
    signData: vi.fn(),
    getAppVersion: vi.fn(),
    disconnect: vi.fn(),
}
const driverOpenMock = vi.fn<LedgerAppDriver['open']>(() => openedTransport)
const fakeDriver: LedgerAppDriver = { chainId: 'test', open: driverOpenMock }

// The real @ledgerhq/react-native-hid DeviceObj exposes only vendorId,
// productId and deviceName — there is no stable per-device id — so
// descriptorId() falls back to the model-wide productId. Fixtures mirror that.
const NANO_S_PLUS_DESCRIPTOR = {
    productId: 0x4011,
    vendorId: 0x2c97,
    deviceName: 'Nano S Plus',
}

const NANO_X_DESCRIPTOR = {
    productId: 0x0004,
    vendorId: 0x2c97,
    deviceName: 'Nano X',
}

const connectToFirstDevice = async (
    descriptor: typeof NANO_S_PLUS_DESCRIPTOR = NANO_S_PLUS_DESCRIPTOR,
) => {
    transportListMock.mockResolvedValue([descriptor])
    return new RNLedgerUsbService()
        .createTransportProvider()
        .connect('ignored-by-usb')
}

describe('RNLedgerUsbService', () => {
    beforeEach(() => {
        driverOpenMock.mockClear()
        ledgerAppDriverRegistry.reset()
        ledgerAppDriverRegistry.register(fakeDriver)
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportListMock.mockReset()
        transportListMock.mockResolvedValue([])
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
    })

    test('declares manufacturer "ledger" and transportType "usb"', () => {
        const provider = new RNLedgerUsbService().createTransportProvider()
        expect(provider.manufacturer).toBe('ledger')
        expect(provider.transportType).toBe('usb')
    })

    test('scan emits "add" events as devices tagged transportType "usb"', () => {
        let observer: { next: (event: unknown) => void } = { next: () => {} }
        const unsubscribe = vi.fn()
        transportListenMock.mockImplementation(subscription => {
            observer = subscription
            return { unsubscribe }
        })

        const onDevice = vi.fn()
        const stop = new RNLedgerUsbService()
            .createTransportProvider()
            .scan(onDevice)

        observer.next({ type: 'add', descriptor: NANO_S_PLUS_DESCRIPTOR })

        expect(onDevice).toHaveBeenCalledWith(
            expect.objectContaining({
                manufacturer: 'ledger',
                transportType: 'usb',
                name: expect.stringContaining('Nano'),
            }),
        )

        stop()
        expect(unsubscribe).toHaveBeenCalled()
    })

    test('scan ignores non-"add" events', () => {
        let observer: { next: (event: unknown) => void } = { next: () => {} }
        transportListenMock.mockImplementation(subscription => {
            observer = subscription
            return { unsubscribe: vi.fn() }
        })

        const onDevice = vi.fn()
        new RNLedgerUsbService().createTransportProvider().scan(onDevice)

        observer.next({ type: 'remove', descriptor: { deviceId: 1 } })
        expect(onDevice).not.toHaveBeenCalled()
    })

    test('connect opens the first connected Ledger from the live device list', async () => {
        const transport = await connectToFirstDevice()

        expect(transportListMock).toHaveBeenCalled()
        expect(transportOpenMock).toHaveBeenCalledWith(NANO_S_PLUS_DESCRIPTOR)
        expect(typeof transport.getAddress).toBe('function')
        expect(typeof transport.signTransaction).toBe('function')
        expect(typeof transport.disconnect).toBe('function')
    })

    test('connect rejects when no Ledger is connected over USB', async () => {
        const provider = new RNLedgerUsbService().createTransportProvider()

        await expect(provider.connect('any-id')).rejects.toBeInstanceOf(
            LedgerUsbNoDeviceError,
        )
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('connect refuses when more than one Ledger is attached, even if the requested id matches one (native HID selects by vendorId alone and cannot target a specific device)', async () => {
        transportListMock.mockResolvedValue([
            NANO_S_PLUS_DESCRIPTOR,
            NANO_X_DESCRIPTOR,
        ])

        await expect(
            new RNLedgerUsbService()
                .createTransportProvider()
                .connect(String(NANO_X_DESCRIPTOR.productId)),
        ).rejects.toBeInstanceOf(LedgerUsbMultipleDevicesError)
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('connect falls back to the sole attached Ledger when the requested id no longer matches (USB ids reassign on replug)', async () => {
        transportListMock.mockResolvedValue([NANO_S_PLUS_DESCRIPTOR])

        await new RNLedgerUsbService()
            .createTransportProvider()
            .connect('stale-id-from-before-replug')

        expect(transportOpenMock).toHaveBeenCalledWith(NANO_S_PLUS_DESCRIPTOR)
    })

    test('opens the app through the registered driver', async () => {
        const rawTransport = { close: transportCloseMock }
        transportOpenMock.mockResolvedValue(rawTransport)

        const transport = await connectToFirstDevice()

        expect(driverOpenMock).toHaveBeenCalledWith(rawTransport)
        expect(transport).toBe(openedTransport)
    })

    test('throws before touching the device when no app driver is registered', async () => {
        ledgerAppDriverRegistry.reset()

        await expect(connectToFirstDevice()).rejects.toBeInstanceOf(
            LedgerAppDriverNotRegisteredError,
        )
        expect(transportListMock).not.toHaveBeenCalled()
        expect(transportOpenMock).not.toHaveBeenCalled()
    })

    test('isSupported delegates to TransportHID.isSupported', async () => {
        transportIsSupportedMock.mockResolvedValue(true)
        const ok = await new RNLedgerUsbService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(true)
    })

    test('isSupported returns false if TransportHID.isSupported throws', async () => {
        transportIsSupportedMock.mockImplementation(() => {
            throw new Error('HID native module not available')
        })
        const ok = await new RNLedgerUsbService()
            .createTransportProvider()
            .isSupported()
        expect(ok).toBe(false)
    })
})
