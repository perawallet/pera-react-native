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
const algorandGetAddressMock = vi.hoisted(() => vi.fn())
const algorandSignMock = vi.hoisted(() => vi.fn())
const algorandGetVersionMock = vi.hoisted(() => vi.fn())
const algorandSignDataMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/hw-transport-web-ble', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        isSupported: transportIsSupportedMock,
        observeAvailability: transportObserveAvailabilityMock,
    },
}))

vi.mock('@algorandfoundation/ledger-algorand-js', () => ({
    AlgorandApp: class {
        getAddressAndPubKey = algorandGetAddressMock
        sign = algorandSignMock
        getVersion = algorandGetVersionMock
        signData = algorandSignDataMock
    },
}))

import { LedgerWebBleService } from '../LedgerWebBleService'
import {
    LedgerSigningError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-extension-ledger-shared'

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
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportObserveAvailabilityMock.mockReset()
        transportCloseMock.mockReset()
        algorandGetAddressMock.mockReset()
        algorandSignMock.mockReset()
        algorandGetVersionMock.mockReset()
        algorandSignDataMock.mockReset()
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

    test('wrapped transport.getAddress delegates to AlgorandApp and returns public-key bytes', async () => {
        algorandGetAddressMock.mockResolvedValue({
            address: Buffer.from('ALGO_ADDR'),
            publicKey: Buffer.from(
                'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
                'hex',
            ),
        })

        const transport = await scanAndConnect()
        const account = await transport.getAddress(0)

        expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
        expect(account.address).toBe('ALGO_ADDR')
        expect(account.publicKey).toBeInstanceOf(Uint8Array)
        expect(account.publicKey).toHaveLength(32)
        expect(account.accountIndex).toBe(0)
    })

    test('wrapped transport.signTransaction returns clean signature bytes', async () => {
        algorandSignMock.mockResolvedValue({
            signature: Buffer.from([1, 2, 3]),
        })

        const transport = await scanAndConnect()
        const sig = await transport.signTransaction(0, new Uint8Array([10]))

        expect(algorandSignMock).toHaveBeenCalledWith(0, Buffer.from([10]))
        expect(Array.from(sig)).toEqual([1, 2, 3])
    })

    test('signTransaction throws LedgerSigningError on empty signature', async () => {
        algorandSignMock.mockResolvedValue({ signature: Buffer.alloc(0) })
        const transport = await scanAndConnect()

        await expect(
            transport.signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerSigningError)
    })

    test('signTransaction translates app errors through classifyLedgerError', async () => {
        algorandSignMock.mockRejectedValue({ returnCode: 0x69_86 })
        const transport = await scanAndConnect()

        await expect(
            transport.signTransaction(0, new Uint8Array([1])),
        ).rejects.toBeInstanceOf(LedgerUserRejectedError)
    })

    test('wrapped transport.disconnect closes the underlying BLE transport', async () => {
        transportCloseMock.mockResolvedValue(undefined)
        const transport = await scanAndConnect()
        await transport.disconnect()

        expect(transportCloseMock).toHaveBeenCalled()
    })

    test('getAppVersion delegates to the app and returns the version triple', async () => {
        algorandGetVersionMock.mockResolvedValue({
            major: 2,
            minor: 1,
            patch: 3,
        })
        const transport = await scanAndConnect()

        const version = await transport.getAppVersion()
        expect(version).toEqual({ major: 2, minor: 1, patch: 3 })
    })

    test('signData maps the request onto the app and returns signature bytes', async () => {
        algorandSignDataMock.mockResolvedValue({
            signature: Uint8Array.from([9, 8, 7]),
        })
        const transport = await scanAndConnect()

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

    test('signData throws LedgerSigningError on empty signature', async () => {
        algorandSignDataMock.mockResolvedValue({
            signature: new Uint8Array(0),
        })
        const transport = await scanAndConnect()

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
