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
const algorandGetAddressMock = vi.hoisted(() => vi.fn())
const algorandSignMock = vi.hoisted(() => vi.fn())
const algorandGetVersionMock = vi.hoisted(() => vi.fn())
const algorandSignDataMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/react-native-hid', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        list: transportListMock,
        isSupported: transportIsSupportedMock,
    },
}))

vi.mock('@algorandfoundation/ledger-algorand-js', () => ({
    AlgorandApp: class {
        getAddressAndPubKey = algorandGetAddressMock
        sign = algorandSignMock
        getVersion = algorandGetVersionMock
        signData = algorandSignDataMock
    },
    ScopeType: { UNKNOWN: -1, AUTH: 1 },
}))

import { RNLedgerUsbService } from '../RNLedgerUsbService'
import {
    LedgerSigningError,
    LedgerUsbMultipleDevicesError,
    LedgerUsbNoDeviceError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-extension-ledger-shared'

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
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportListMock.mockReset()
        transportListMock.mockResolvedValue([])
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        algorandGetAddressMock.mockReset()
        algorandSignMock.mockReset()
        algorandGetVersionMock.mockReset()
        algorandSignDataMock.mockReset()
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

    test('wrapped transport.getAddress delegates to AlgorandApp and returns public-key bytes', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.from(
                'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
                'hex',
            ),
        })

        const transport = await connectToFirstDevice()
        const account = await transport.getAddress(0)

        expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
        expect(account.address).toBe('ALGO_ADDR')
        expect(account.publicKey).toBeInstanceOf(Uint8Array)
        expect(account.publicKey).toHaveLength(32)
        expect(account.accountIndex).toBe(0)
    })

    test('wrapped transport.signTransaction returns clean signature bytes (no trailing APDU status word)', async () => {
        // @algorandfoundation/ledger-algorand-js strips the trailing status
        // word internally — the returned signature is already clean.
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        const transport = await connectToFirstDevice()
        const sig = await transport.signTransaction(0, new Uint8Array([10]))

        expect(algorandSignMock).toHaveBeenCalledWith(0, Buffer.from([10]))
        expect(Array.from(sig)).toEqual([1, 2, 3])
    })

    test('signTransaction primes the device via getAddressAndPubKey before every sign call', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.alloc(32),
        })
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })
        const transport = await connectToFirstDevice()

        await transport.signTransaction(0, new Uint8Array([10, 20]))

        expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
        expect(algorandGetAddressMock.mock.invocationCallOrder[0]).toBeLessThan(
            algorandSignMock.mock.invocationCallOrder[0],
        )
    })

    test('signTransaction re-primes on every call for the same account index — no caching', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.alloc(32),
        })
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })
        const transport = await connectToFirstDevice()

        await transport.signTransaction(0, new Uint8Array([10]))
        await transport.signTransaction(0, new Uint8Array([20]))
        await transport.signTransaction(0, new Uint8Array([30]))

        expect(algorandGetAddressMock).toHaveBeenCalledTimes(3)
        expect(algorandSignMock).toHaveBeenCalledTimes(3)
    })

    test('signTransaction primes the requested account index, not a hardcoded one', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.alloc(32),
        })
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })
        const transport = await connectToFirstDevice()

        await transport.signTransaction(7, new Uint8Array([10]))

        expect(algorandGetAddressMock).toHaveBeenCalledWith(7, false)
        expect(algorandSignMock).toHaveBeenCalledWith(7, Buffer.from([10]))
    })

    test('signTransaction throws LedgerSigningError on empty signature', async () => {
        algorandSignMock.mockResolvedValue({ signature: Buffer.alloc(0) })

        const transport = await connectToFirstDevice()

        await expect(
            transport.signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerSigningError)
    })

    test('signTransaction translates app errors through classifyLedgerError', async () => {
        algorandSignMock.mockRejectedValue({ returnCode: 0x6986 })
        const transport = await connectToFirstDevice()

        await expect(
            transport.signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerUserRejectedError)
    })

    test('wrapped transport.disconnect closes the underlying HID transport', async () => {
        transportCloseMock.mockResolvedValue(undefined)

        const transport = await connectToFirstDevice()
        await transport.disconnect()

        expect(transportCloseMock).toHaveBeenCalled()
    })

    test('getAppVersion delegates to the app and returns the version triple', async () => {
        algorandGetVersionMock.mockResolvedValue({
            major: 2,
            minor: 1,
            patch: 3,
        })
        const transport = await connectToFirstDevice()

        const version = await transport.getAppVersion()

        expect(version).toEqual({ major: 2, minor: 1, patch: 3 })
    })

    test('signData maps the request onto the app and returns signature bytes', async () => {
        algorandSignDataMock.mockResolvedValue({
            signature: Uint8Array.from([9, 8, 7]),
        })
        const transport = await connectToFirstDevice()

        const sig = await transport.signData({
            accountIndex: 0,
            data: 'e30=',
            signerPublicKey: new Uint8Array(32),
            domain: 'example.com',
            authenticatorData: new Uint8Array(37),
            requestId: undefined,
            scope: 1,
            encoding: 'base64',
        })

        expect(algorandSignDataMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: 'e30=',
                domain: 'example.com',
                hdPath: "m/44'/283'/0'/0/0",
                authenticationData: expect.any(Uint8Array),
                signer: expect.any(Uint8Array),
            }),
            { scope: 1, encoding: 'base64' },
        )
        expect(Array.from(sig)).toEqual([9, 8, 7])
    })

    test('signData translates app errors through classifyLedgerError', async () => {
        algorandSignDataMock.mockRejectedValue({ returnCode: 0x6986 })
        const transport = await connectToFirstDevice()

        await expect(
            transport.signData({
                accountIndex: 0,
                data: 'e30=',
                signerPublicKey: new Uint8Array(32),
                domain: 'example.com',
                authenticatorData: new Uint8Array(37),
                scope: 1,
                encoding: 'base64',
            }),
        ).rejects.toBeInstanceOf(LedgerUserRejectedError)
    })

    test('signData throws LedgerSigningError on empty signature', async () => {
        algorandSignDataMock.mockResolvedValue({ signature: new Uint8Array(0) })
        const transport = await connectToFirstDevice()

        await expect(
            transport.signData({
                accountIndex: 0,
                data: 'e30=',
                signerPublicKey: new Uint8Array(32),
                domain: 'example.com',
                authenticatorData: new Uint8Array(37),
                scope: 1,
                encoding: 'base64',
            }),
        ).rejects.toBeInstanceOf(LedgerSigningError)
    })

    test('getAppVersion translates app errors through classifyLedgerError', async () => {
        algorandGetVersionMock.mockRejectedValue({ returnCode: 0x6986 })
        const transport = await connectToFirstDevice()

        await expect(transport.getAppVersion()).rejects.toBeInstanceOf(
            LedgerUserRejectedError,
        )
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
