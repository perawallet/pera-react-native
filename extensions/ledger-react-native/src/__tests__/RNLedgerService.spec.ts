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

import { describe, test, it, expect, vi, beforeEach } from 'vitest'

const transportListenMock = vi.hoisted(() => vi.fn())
const transportOpenMock = vi.hoisted(() => vi.fn())
const transportIsSupportedMock = vi.hoisted(() => vi.fn())
const transportObserveStateMock = vi.hoisted(() => vi.fn())
const transportCloseMock = vi.hoisted(() => vi.fn())

// Captures the single module-scope observer RNLedgerService registers via
// TransportBLE.observeState (created lazily on first use, shared for the
// process lifetime, unsubscribe is a no-op). Lets tests that run after the
// observer exists drive adapter-state changes from one place.
const btObserverHolder = vi.hoisted(
    () =>
        ({ current: null }) as {
            current: null | {
                next: (e: { type: string; available: boolean }) => void
            }
        },
)
const permissionsCheckMock = vi.hoisted(() => vi.fn())
const peraBluetoothRequestEnableMock = vi.hoisted(() => vi.fn())

vi.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
    default: {
        listen: transportListenMock,
        open: transportOpenMock,
        isSupported: transportIsSupportedMock,
        observeState: transportObserveStateMock,
    },
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: (name: string) =>
        name === 'PeraBluetooth'
            ? { requestEnable: peraBluetoothRequestEnableMock }
            : null,
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
import {
    LedgerAppDriverNotRegisteredError,
    ledgerAppDriverRegistry,
    type HardwareWalletTransport,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import { RNLedgerService } from '../RNLedgerService'
import { classifyBleLedgerError } from '../classifyBleLedgerError'
import {
    LedgerConnectionError,
    LedgerUserRejectedError,
    LedgerAppNotOpenError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
    LedgerDeviceNotFoundError,
    classifyLedgerError,
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

const createHwTransportError = (originCode: number): Error => {
    const error = new Error(`BleError. Origin: ${originCode}`)
    error.name = 'HwTransportError'
    return error
}

describe('RNLedgerService', () => {
    beforeEach(() => {
        transportListenMock.mockReset()
        transportOpenMock.mockReset()
        transportIsSupportedMock.mockReset()
        transportCloseMock.mockReset()
        permissionsCheckMock.mockReset()
        driverOpenMock.mockClear()
        ledgerAppDriverRegistry.reset()
        ledgerAppDriverRegistry.register(fakeDriver)
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
        // The module-scope observer is created once per process, by whichever
        // path gets there first — a `connect` pre-flight or an explicit
        // subscribe. Capturing it here (rather than inside the test that
        // happens to trigger creation) keeps the holder populated no matter
        // which test ran first.
        transportObserveStateMock.mockImplementation(
            (o: {
                next: (e: { type: string; available: boolean }) => void
            }) => {
                btObserverHolder.current = o
                return { unsubscribe: () => {} }
            },
        )
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

        test('maps ble-plx origin codes on scan errors', () => {
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

            observer.error(createHwTransportError(102))

            expect(onError).toHaveBeenCalledWith(
                expect.any(LedgerBluetoothDisabledError),
            )
        })
    })

    describe('createTransportProvider().connect', () => {
        test('opens the app through the registered driver with the BLE classifier', async () => {
            const bleTransport = { close: transportCloseMock }
            transportOpenMock.mockResolvedValue(bleTransport)

            const transport = await new RNLedgerService()
                .createTransportProvider()
                .connect('device-id')

            expect(transportOpenMock).toHaveBeenCalledWith('device-id')
            expect(driverOpenMock).toHaveBeenCalledWith(
                bleTransport,
                classifyBleLedgerError,
            )
            expect(transport).toBe(openedTransport)
        })

        test('throws before opening the device when no app driver is registered', async () => {
            ledgerAppDriverRegistry.reset()

            await expect(
                new RNLedgerService()
                    .createTransportProvider()
                    .connect('device-id'),
            ).rejects.toBeInstanceOf(LedgerAppDriverNotRegisteredError)
            expect(transportOpenMock).not.toHaveBeenCalled()
        })

        test('classifies and rethrows errors from TransportBLE.open', async () => {
            transportOpenMock.mockRejectedValue(new Error('ble open failed'))

            await expect(
                new RNLedgerService()
                    .createTransportProvider()
                    .connect('device-id'),
            ).rejects.toThrow()
        })

        test('maps ble-plx origin codes from TransportBLE.open', async () => {
            transportOpenMock.mockRejectedValue(createHwTransportError(204))

            await expect(
                new RNLedgerService()
                    .createTransportProvider()
                    .connect('device-id'),
            ).rejects.toBeInstanceOf(LedgerDeviceNotFoundError)
        })
    })

    describe('connect pre-flight checks', () => {
        beforeEach(() => {
            vi.clearAllMocks()
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

    test('isSupported delegates to TransportBLE.isSupported', async () => {
        transportIsSupportedMock.mockResolvedValue(true)

        const result = await new RNLedgerService()
            .createTransportProvider()
            .isSupported()

        expect(result).toBe(true)
    })

    // A single test exercises the whole observer because the underlying
    // TransportBLE.observeState listener is attached once at module scope and
    // shared across subscribers (the lib's unsubscribe is a no-op).
    test('observeBluetoothState maps ble-plx states and fans out to subscribers', () => {
        const provider = new RNLedgerService().createTransportProvider()
        const received: string[] = []
        const unsubscribe = provider.observeBluetoothState!(s =>
            received.push(s),
        )

        // The shared observer is registered, and the latest known state is
        // delivered synchronously on subscribe.
        const observer = btObserverHolder.current!
        expect(observer).not.toBeNull()
        expect(received[0]).toBe('unknown')

        observer.next({ type: 'PoweredOff', available: false })
        observer.next({ type: 'PoweredOn', available: true })
        observer.next({ type: 'Unauthorized', available: false })
        observer.next({ type: 'Unsupported', available: false })
        observer.next({ type: 'Resetting', available: false })
        observer.next({ type: 'SomethingElse', available: false })

        expect(received).toContain('poweredOff')
        expect(received).toContain('poweredOn')
        expect(received).toContain('unauthorized')
        expect(received).toContain('unsupported')
        expect(received).toContain('resetting')
        // Unrecognized states fall back to 'unknown'.
        expect(received.filter(s => s === 'unknown').length).toBeGreaterThan(1)

        // After unsubscribe the listener stops receiving updates.
        unsubscribe()
        const before = received.length
        observer.next({ type: 'PoweredOff', available: false })
        expect(received.length).toBe(before)
    })

    // `connect` reads the observed adapter state (not `TransportBLE.isSupported`,
    // which can't detect a disabled radio). Self-contained: seed the shared
    // observer here so the block passes in isolation (`-t`/`.only`) as well as
    // in a full-file run.
    describe('connect adapter-state pre-flight', () => {
        beforeEach(() => {
            // Capture the module-scope observer on registration, then ensure it
            // exists (lazy creation is a no-op if a prior test already made it).
            transportObserveStateMock.mockImplementation(
                (o: {
                    next: (e: { type: string; available: boolean }) => void
                }) => {
                    btObserverHolder.current = o
                    return { unsubscribe: () => {} }
                },
            )
            new RNLedgerService()
                .createTransportProvider()
                .observeBluetoothState?.(() => {})
        })

        it('throws LedgerBluetoothDisabledError when the adapter is powered off', async () => {
            btObserverHolder.current?.next({
                type: 'PoweredOff',
                available: false,
            })

            const provider = new RNLedgerService().createTransportProvider()
            await expect(provider.connect('device-id')).rejects.toBeInstanceOf(
                LedgerBluetoothDisabledError,
            )
        })

        it('proceeds past the pre-flight when the adapter is powered on', async () => {
            btObserverHolder.current?.next({
                type: 'PoweredOn',
                available: true,
            })
            transportOpenMock.mockResolvedValue({ close: transportCloseMock })

            const provider = new RNLedgerService().createTransportProvider()
            await provider.connect('device-id')

            expect(transportOpenMock).toHaveBeenCalledWith('device-id')
        })
    })

    // A fresh module graph is the whole point here: `latestBluetoothState` is
    // module state, and every other test in this file has already populated it.
    // Identity is asserted by message, not `instanceof` (the reset graph builds
    // its own copy of the error classes) and not `name` (which the built dist
    // mangles for every class that doesn't pin it explicitly).
    describe('connect adapter-state pre-flight before any state is known', () => {
        const loadFreshService = async () => {
            vi.resetModules()
            let observer: null | {
                next: (e: { type: string; available: boolean }) => void
            } = null
            transportObserveStateMock.mockImplementation(
                (o: {
                    next: (e: { type: string; available: boolean }) => void
                }) => {
                    observer = o
                    return { unsubscribe: () => {} }
                },
            )
            // resetModules also hands the service a fresh, empty driver registry.
            const hardwareWallet =
                await import('@perawallet/wallet-extension-hardware-wallet')
            hardwareWallet.ledgerAppDriverRegistry.register(fakeDriver)
            const module = await import('../RNLedgerService')
            const provider =
                new module.RNLedgerService().createTransportProvider()
            return { provider, getObserver: () => observer }
        }

        it('waits for the first emission rather than skipping the Bluetooth check', async () => {
            // The regression this guards: a sign in a process that never opened
            // the pairing screen saw `unknown`, skipped the check, and reported
            // a generic connection failure with Bluetooth simply switched off.
            const { provider, getObserver } = await loadFreshService()

            const connectPromise = provider.connect('device-id')
            getObserver()?.next({ type: 'PoweredOff', available: false })

            await expect(connectPromise).rejects.toThrow(
                /Bluetooth must be enabled/,
            )
            expect(transportOpenMock).not.toHaveBeenCalled()
        })

        it('falls through to open when no adapter state ever arrives', async () => {
            vi.useFakeTimers()
            try {
                const { provider } = await loadFreshService()
                transportOpenMock.mockResolvedValue({
                    close: transportCloseMock,
                })

                const connectPromise = provider.connect('device-id')
                await vi.advanceTimersByTimeAsync(1100)
                await connectPromise

                expect(transportOpenMock).toHaveBeenCalledWith('device-id')
            } finally {
                vi.useRealTimers()
            }
        })
    })

    describe('requestBluetoothEnable', () => {
        test('delegates to the native PeraBluetooth module', async () => {
            peraBluetoothRequestEnableMock.mockResolvedValue(true)

            const result = await new RNLedgerService().createTransportProvider()
                .requestBluetoothEnable!()

            expect(peraBluetoothRequestEnableMock).toHaveBeenCalledTimes(1)
            expect(result).toBe(true)
        })

        test('resolves false when the native module rejects', async () => {
            peraBluetoothRequestEnableMock.mockRejectedValue(
                new Error('no activity'),
            )

            const result = await new RNLedgerService().createTransportProvider()
                .requestBluetoothEnable!()

            expect(result).toBe(false)
        })
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
