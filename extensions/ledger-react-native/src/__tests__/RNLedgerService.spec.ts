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

vi.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
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

import { RNLedgerService } from '../RNLedgerService'
import {
    LedgerConnectionError,
    LedgerSigningError,
    LedgerUserRejectedError,
    LedgerAppNotOpenError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
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

    describe('wrapped transport', () => {
        const mountTransport = async () => {
            transportOpenMock.mockResolvedValue({ close: transportCloseMock })
            return new RNLedgerService()
                .createTransportProvider()
                .connect('device-id')
        }

        test('getAddress delegates to the Algorand app and returns public key bytes', async () => {
            algorandGetAddressMock.mockResolvedValue({
                address: 'ALGO_ADDR',
                publicKey:
                    'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
            })
            const transport = await mountTransport()

            const account = await transport.getAddress(0)

            expect(algorandGetAddressMock).toHaveBeenCalledWith(
                "44'/283'/0'/0/0",
                false,
            )
            expect(account.address).toBe('ALGO_ADDR')
            expect(account.publicKey).toBeInstanceOf(Uint8Array)
            expect(account.accountIndex).toBe(0)
        })

        test('getAddress translates app errors through classifyLedgerError', async () => {
            algorandGetAddressMock.mockRejectedValue({ statusCode: 0x6986 })
            const transport = await mountTransport()

            await expect(transport.getAddress(0)).rejects.toBeInstanceOf(
                LedgerUserRejectedError,
            )
        })

        test('signTransaction returns the signature bytes from the app (with the trailing APDU status word stripped)', async () => {
            // hw-app-algorand@6.35.1 returns sig || SW (2 trailing bytes) —
            // mimic that here and assert the wrapper strips the SW.
            algorandSignMock.mockResolvedValue({
                signature: Buffer.from([1, 2, 3, 0x90, 0x00]),
            })
            const transport = await mountTransport()

            const sig = await transport.signTransaction(
                0,
                new Uint8Array([10, 20]),
            )

            expect(algorandSignMock).toHaveBeenCalled()
            expect(Array.from(sig)).toEqual([1, 2, 3])
        })

        test('signTransaction passes through already-classified Ledger errors without re-wrapping', async () => {
            algorandSignMock.mockResolvedValue({ signature: null })
            const transport = await mountTransport()

            // The empty-signature branch raises a LedgerSigningError; the
            // outer catch must not re-wrap it via classifyLedgerError.
            await expect(
                transport.signTransaction(0, new Uint8Array([1])),
            ).rejects.toSatisfy(
                err => err instanceof LedgerSigningError && !err.cause,
            )
        })

        test('disconnect closes the underlying BLE transport', async () => {
            transportCloseMock.mockResolvedValue(undefined)
            const transport = await mountTransport()

            await transport.disconnect()

            expect(transportCloseMock).toHaveBeenCalled()
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
