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

const transportListenMock = vi.hoisted(() => vi.fn())
const transportOpenMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())
const algorandGetAddressMock = vi.hoisted(() => vi.fn())
const algorandSignMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/react-native-hid', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        isSupported: transportIsSupportedMock,
    },
}))

vi.mock('@ledgerhq/hw-app-algorand', () => ({
    default: class {
        getAddress = algorandGetAddressMock
        sign = algorandSignMock
    },
}))

import { RNLedgerUsbService } from '../RNLedgerUsbService'

describe('RNLedgerUsbService', () => {
    beforeEach(() => {
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        algorandGetAddressMock.mockReset()
        algorandSignMock.mockReset()
    })

    test('declares manufacturer "ledger" and transportType "usb"', () => {
        const provider = new RNLedgerUsbService().createTransportProvider()
        expect(provider.manufacturer).toBe('ledger')
        expect(provider.transportType).toBe('usb')
    })

    test('scan emits "add" events as devices tagged transportType "usb"', () => {
        let observer: {
            next: (event: unknown) => void
        } = { next: () => {} }
        const unsubscribe = vi.fn()
        transportListenMock.mockImplementation(subscription => {
            observer = subscription
            return { unsubscribe }
        })

        const onDevice = vi.fn()
        const stop = new RNLedgerUsbService()
            .createTransportProvider()
            .scan(onDevice)

        observer.next({
            type: 'add',
            descriptor: {
                deviceId: 1234,
                productId: 0x4011,
                vendorId: 0x2c97,
                deviceName: 'Nano S Plus',
            },
        })

        expect(onDevice).toHaveBeenCalledTimes(1)
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

    test('connect opens TransportHID and returns a wrapped transport', async () => {
        const hidTransport = { close: transportCloseMock }
        transportOpenMock.mockResolvedValue(hidTransport)

        const transport = await new RNLedgerUsbService()
            .createTransportProvider()
            .connect('usb-dev-1')

        expect(transportOpenMock).toHaveBeenCalledWith('usb-dev-1')
        expect(typeof transport.getAddress).toBe('function')
        expect(typeof transport.signTransaction).toBe('function')
        expect(typeof transport.disconnect).toBe('function')
    })

    test('wrapped transport.getAddress delegates to AppAlgorand and returns public-key bytes', async () => {
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
        algorandGetAddressMock.mockResolvedValue({
            address: 'ALG_ADDR',
            publicKey:
                'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
        })

        const transport = await new RNLedgerUsbService()
            .createTransportProvider()
            .connect('usb-dev-1')

        const account = await transport.getAddress(0)
        expect(algorandGetAddressMock).toHaveBeenCalledWith(
            "44'/283'/0'/0/0",
            false,
        )
        expect(account.address).toBe('ALG_ADDR')
        expect(account.publicKey).toBeInstanceOf(Uint8Array)
        expect(account.accountIndex).toBe(0)
    })

    test('wrapped transport.signTransaction returns signature bytes', async () => {
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        const transport = await new RNLedgerUsbService()
            .createTransportProvider()
            .connect('usb-dev-1')

        const sig = await transport.signTransaction(0, new Uint8Array([10]))
        expect(algorandSignMock).toHaveBeenCalled()
        expect(Array.from(sig)).toEqual([1, 2, 3])
    })

    test('wrapped transport.disconnect closes the underlying HID transport', async () => {
        transportOpenMock.mockResolvedValue({ close: transportCloseMock })
        transportCloseMock.mockResolvedValue(undefined)

        const transport = await new RNLedgerUsbService()
            .createTransportProvider()
            .connect('usb-dev-1')

        await transport.disconnect()
        expect(transportCloseMock).toHaveBeenCalled()
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
