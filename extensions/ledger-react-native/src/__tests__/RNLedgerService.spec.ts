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

import { describe, test, it, expect, vi, beforeEach } from 'vitest'

const transportListenMock = vi.hoisted(() => vi.fn())
const transportOpenMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())
const algorandGetAddressMock = vi.hoisted(() => vi.fn())
const algorandSignMock = vi.hoisted(() => vi.fn())
const algorandGetVersionMock = vi.hoisted(() => vi.fn())
const algorandSignDataMock = vi.hoisted(() => vi.fn())
const permissionsCheckMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
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

vi.mock('react-native', () => ({
    Platform: { OS: 'ios', Version: 17 },
    PermissionsAndroid: {
        check: permissionsCheckMock,
        PERMISSIONS: {
            BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
            BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
            ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        },
    },
}))

import { Platform } from 'react-native'
import { RNLedgerService } from '../RNLedgerService'
import {
    LedgerConnectionError,
    LedgerSigningError,
    LedgerUserRejectedError,
    LedgerAppNotOpenError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
    classifyLedgerError,
} from '../errors'

describe('RNLedgerService', () => {
    beforeEach(() => {
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        algorandGetAddressMock.mockReset()
        algorandSignMock.mockReset()
        algorandGetVersionMock.mockReset()
        algorandSignDataMock.mockReset()
        permissionsCheckMock.mockReset()
        // Default pre-flight state: BLE supported, iOS (skips perm check).
        // Tests that need to exercise the failure paths override these.
        transportIsSupportedMock.mockResolvedValue(true)
        Object.defineProperty(Platform, 'OS', {
            value: 'ios',
            configurable: true,
        })
        Object.defineProperty(Platform, 'Version', {
            value: 17,
            configurable: true,
        })
    })

    describe('createTransportProvider().scan', () => {
        test('emits "add" events as normalized LedgerDevice and ignores other events', () => {
            let observer: {
                next: (event: unknown) => void
                error: (err: unknown) => void
                complete: () => void
            } = { next: () => {}, error: () => {}, complete: () => {} }
            const unsubscribe = vi.fn()
            transportListenMock.mockImplementation(subscription => {
                observer = subscription
                return { unsubscribe }
            })

            const onDevice = vi.fn()
            const service = new RNLedgerService()
            const stop = service.createTransportProvider().scan(onDevice)

            observer.next({
                type: 'add',
                descriptor: {
                    id: 'd1',
                    name: 'My Nano',
                    serviceUUIDs: null,
                    rssi: -60,
                },
            })
            observer.next({
                type: 'remove',
                descriptor: {
                    id: 'd2',
                    name: 'Other',
                    serviceUUIDs: null,
                    rssi: null,
                },
            })

            expect(onDevice).toHaveBeenCalledTimes(1)
            expect(onDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'd1',
                    name: 'My Nano',
                    manufacturer: 'ledger',
                    transportType: 'ble',
                    rssi: -60,
                }),
            )

            stop()
            expect(unsubscribe).toHaveBeenCalled()
        })

        test('supplies a default name when the descriptor does not provide one', () => {
            let observer: { next: (event: unknown) => void } = {
                next: () => {},
            }
            transportListenMock.mockImplementation(subscription => {
                observer = subscription
                return { unsubscribe: vi.fn() }
            })

            const onDevice = vi.fn()
            new RNLedgerService().createTransportProvider().scan(onDevice)

            observer.next({
                type: 'add',
                descriptor: {
                    id: 'd1',
                    name: '',
                    serviceUUIDs: null,
                    rssi: null,
                },
            })

            expect(onDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: expect.stringMatching(/^Ledger /),
                    rssi: null,
                }),
            )
        })

        test('forwards classified errors to the onError callback', () => {
            let observer: { error: (err: unknown) => void } = {
                error: () => {},
            }
            transportListenMock.mockImplementation(subscription => {
                observer = subscription
                return { unsubscribe: vi.fn() }
            })

            const onError = vi.fn()
            new RNLedgerService()
                .createTransportProvider()
                .scan(() => {}, onError)

            observer.error(new Error('ble failure'))

            expect(onError).toHaveBeenCalledWith(expect.any(Error))
        })

        test('wraps non-Error thrown values in a LedgerConnectionError', () => {
            let observer: { error: (err: unknown) => void } = {
                error: () => {},
            }
            transportListenMock.mockImplementation(subscription => {
                observer = subscription
                return { unsubscribe: vi.fn() }
            })

            const onError = vi.fn()
            new RNLedgerService()
                .createTransportProvider()
                .scan(() => {}, onError)

            observer.error('string error')

            expect(onError).toHaveBeenCalledWith(
                expect.any(LedgerConnectionError),
            )
        })
    })

    describe('createTransportProvider().connect', () => {
        test('returns a wrapped transport on success', async () => {
            const bleTransport = { close: transportCloseMock }
            transportOpenMock.mockResolvedValue(bleTransport)

            const transport = await new RNLedgerService()
                .createTransportProvider()
                .connect('device-id')

            expect(transportOpenMock).toHaveBeenCalledWith('device-id')
            expect(typeof transport.getAddress).toBe('function')
            expect(typeof transport.signTransaction).toBe('function')
            expect(typeof transport.disconnect).toBe('function')
        })

        test('classifies and rethrows errors from TransportBLE.open', async () => {
            transportOpenMock.mockRejectedValue(new Error('ble open failed'))

            await expect(
                new RNLedgerService()
                    .createTransportProvider()
                    .connect('device-id'),
            ).rejects.toThrow()
        })
    })

    describe('connect pre-flight checks', () => {
        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('throws LedgerBluetoothDisabledError when TransportBLE.isSupported returns false', async () => {
            vi.mocked(transportIsSupportedMock).mockResolvedValueOnce(false)
            const service = new RNLedgerService()
            const provider = service.createTransportProvider()
            await expect(provider.connect('device-id')).rejects.toBeInstanceOf(
                LedgerBluetoothDisabledError,
            )
        })

        it('throws LedgerPermissionDeniedError on Android when BLE scan permission is missing', async () => {
            vi.mocked(transportIsSupportedMock).mockResolvedValueOnce(true)
            // Force android with API 31+ and missing scan permission
            Object.defineProperty(Platform, 'OS', {
                value: 'android',
                configurable: true,
            })
            Object.defineProperty(Platform, 'Version', {
                value: 31,
                configurable: true,
            })
            vi.mocked(permissionsCheckMock).mockResolvedValue(false)
            const service = new RNLedgerService()
            const provider = service.createTransportProvider()
            await expect(provider.connect('device-id')).rejects.toBeInstanceOf(
                LedgerPermissionDeniedError,
            )
        })

        it('proceeds to TransportBLE.open when BLE is supported and permissions are granted', async () => {
            vi.mocked(transportIsSupportedMock).mockResolvedValueOnce(true)
            Object.defineProperty(Platform, 'OS', {
                value: 'ios',
                configurable: true,
            }) // iOS skips perm check
            const fakeBleTransport = { close: vi.fn() } as never
            vi.mocked(transportOpenMock).mockResolvedValueOnce(fakeBleTransport)
            const service = new RNLedgerService()
            const provider = service.createTransportProvider()
            const transport = await provider.connect('device-id')
            expect(transportOpenMock).toHaveBeenCalledWith('device-id')
            expect(transport).toBeDefined()
        })
    })

    describe('wrapped transport', () => {
        const mountTransport = async () => {
            transportOpenMock.mockResolvedValue({ close: transportCloseMock })
            return new RNLedgerService()
                .createTransportProvider()
                .connect('device-id')
        }

        test('getAddress delegates to the Algorand app and returns public key bytes', async () => {
            algorandGetAddressMock.mockResolvedValue({
                address: Buffer.from('ALGO_ADDR'),
                publicKey: Buffer.from(
                    'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
                    'hex',
                ),
            })
            const transport = await mountTransport()

            const account = await transport.getAddress(0)

            expect(algorandGetAddressMock).toHaveBeenCalledWith(0, false)
            expect(account.address).toBe('ALGO_ADDR')
            expect(account.publicKey).toBeInstanceOf(Uint8Array)
            expect(account.publicKey.length).toBe(32)
            expect(account.accountIndex).toBe(0)
        })

        test('getAddress translates app errors through classifyLedgerError', async () => {
            algorandGetAddressMock.mockRejectedValue({ statusCode: 0x6986 })
            const transport = await mountTransport()

            await expect(transport.getAddress(0)).rejects.toBeInstanceOf(
                LedgerUserRejectedError,
            )
        })

        test('signTransaction returns the signature bytes from the app', async () => {
            algorandSignMock.mockResolvedValue({
                signature: Buffer.from([1, 2, 3]),
            })
            const transport = await mountTransport()

            const sig = await transport.signTransaction(
                0,
                new Uint8Array([10, 20]),
            )

            expect(algorandSignMock).toHaveBeenCalledWith(
                0,
                Buffer.from([10, 20]),
            )
            expect(Array.from(sig)).toEqual([1, 2, 3])
        })

        test('signTransaction throws LedgerSigningError on empty signature', async () => {
            algorandSignMock.mockResolvedValue({ signature: Buffer.alloc(0) })
            const transport = await mountTransport()

            await expect(
                transport.signTransaction(0, new Uint8Array([1])),
            ).rejects.toBeInstanceOf(LedgerSigningError)
        })

        test('signTransaction translates app errors through classifyLedgerError', async () => {
            algorandSignMock.mockRejectedValue({ returnCode: 0x6986 })
            const transport = await mountTransport()

            await expect(
                transport.signTransaction(0, new Uint8Array([1])),
            ).rejects.toBeInstanceOf(LedgerUserRejectedError)
        })

        test('disconnect closes the underlying BLE transport', async () => {
            transportCloseMock.mockResolvedValue(undefined)
            const transport = await mountTransport()

            await transport.disconnect()

            expect(transportCloseMock).toHaveBeenCalled()
        })

        test('getAppVersion delegates to the app and returns the version triple', async () => {
            algorandGetVersionMock.mockResolvedValue({
                major: 2,
                minor: 1,
                patch: 3,
            })
            const transport = await mountTransport()

            const version = await transport.getAppVersion()

            expect(version).toEqual({ major: 2, minor: 1, patch: 3 })
        })

        test('signData maps the request onto the app and returns signature bytes', async () => {
            algorandSignDataMock.mockResolvedValue({
                signature: Uint8Array.from([9, 8, 7]),
            })
            const transport = await mountTransport()

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
                    hdPath: "44'/283'/0'/0/0",
                    authenticationData: expect.any(Uint8Array),
                    signer: expect.any(Uint8Array),
                }),
                { scope: 1, encoding: 'base64' },
            )
            expect(Array.from(sig)).toEqual([9, 8, 7])
        })

        test('signData translates app errors through classifyLedgerError', async () => {
            algorandSignDataMock.mockRejectedValue({ returnCode: 0x6986 })
            const transport = await mountTransport()

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
            const transport = await mountTransport()

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
            const transport = await mountTransport()

            await expect(transport.getAppVersion()).rejects.toBeInstanceOf(
                LedgerUserRejectedError,
            )
        })
    })

    test('isSupported delegates to TransportBLE.isSupported', async () => {
        transportIsSupportedMock.mockResolvedValue(true)

        const result = await new RNLedgerService()
            .createTransportProvider()
            .isSupported()

        expect(result).toBe(true)
    })

    describe('classifyLedgerError', () => {
        test('classifies 0x6985 as LedgerUserRejectedError', () => {
            const error = { statusCode: 0x6985 }
            const classified = classifyLedgerError(error)
            expect(classified).toBeInstanceOf(LedgerUserRejectedError)
        })

        test('classifies 0x6986 as LedgerUserRejectedError', () => {
            const error = { statusCode: 0x6986 }
            const classified = classifyLedgerError(error)
            expect(classified).toBeInstanceOf(LedgerUserRejectedError)
        })

        test('classifies 0x6e00 as LedgerAppNotOpenError', () => {
            const error = { statusCode: 0x6e00 }
            const classified = classifyLedgerError(error)
            expect(classified).toBeInstanceOf(LedgerAppNotOpenError)
        })

        test('classifies disconnect message as LedgerDisconnectedError', () => {
            const error = new Error('Device disconnected')
            const classified = classifyLedgerError(error)
            expect(classified).toBeInstanceOf(LedgerDisconnectedError)
        })

        test('classifies timeout message as LedgerTimeoutError', () => {
            const error = new Error('Connection timeout')
            const classified = classifyLedgerError(error)
            expect(classified).toBeInstanceOf(LedgerTimeoutError)
        })
    })
})
