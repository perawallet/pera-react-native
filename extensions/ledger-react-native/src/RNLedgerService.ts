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

import { requireOptionalNativeModule } from 'expo'
import { Platform, PermissionsAndroid } from 'react-native'
import type { HardwareWalletService } from '@perawallet/wallet-extension-platform'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { HardwareWalletAdapterState } from '@perawallet/wallet-core-hardware-wallet'
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble'
import { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import type {
    LedgerTransportProvider,
    LedgerTransport,
    LedgerDevice,
} from '@perawallet/wallet-extension-ledger-shared'
import {
    classifyLedgerError,
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
} from '@perawallet/wallet-extension-ledger-shared'
import { resolveDeviceModel } from '@perawallet/wallet-extension-ledger-shared'
import { createLedgerTransportWrapper } from '@perawallet/wallet-extension-ledger-shared'

/** Unrecognized values fall back to `unknown`. */
const BLE_STATE_MAP: Record<string, HardwareWalletAdapterState> = {
    PoweredOn: 'poweredOn',
    PoweredOff: 'poweredOff',
    Unauthorized: 'unauthorized',
    Unsupported: 'unsupported',
    Resetting: 'resetting',
}

const mapBluetoothState = (type: string): HardwareWalletAdapterState =>
    BLE_STATE_MAP[type] ?? 'unknown'

type BluetoothStateListener = (state: HardwareWalletAdapterState) => void

/**
 * Surfaces the OS "turn on Bluetooth" prompt. Absent in unit tests and unlinked
 * builds, hence the optional require.
 */
interface NativePeraBluetooth {
    requestEnable(): Promise<boolean>
}

const getNativeBluetoothModule = (): NativePeraBluetooth | null =>
    requireOptionalNativeModule<NativePeraBluetooth>('PeraBluetooth')

/**
 * `TransportBLE.observeState` returns a no-op `unsubscribe` — the lib never
 * detaches its listener — so a fresh one would leak on every screen mount.
 * One module-scope observer fans out to our own subscriber set instead; it's
 * created lazily and then lives for the process, matching the lib anyway.
 */
let bluetoothStateListeners: Nullable<Set<BluetoothStateListener>> = null
let latestBluetoothState: HardwareWalletAdapterState = 'unknown'

const ensureBluetoothObserver = (): Nullable<Set<BluetoothStateListener>> => {
    if (bluetoothStateListeners) return bluetoothStateListeners

    const listeners = new Set<BluetoothStateListener>()
    bluetoothStateListeners = listeners

    // Absent in a build where the BLE module isn't linked. Returning null (with
    // the set still memoized, so this is a one-time check) keeps the provider
    // constructible and leaves callers on `unknown` — the pre-`observeState`
    // behavior — rather than failing every Ledger operation.
    if (typeof TransportBLE.observeState !== 'function') return null

    TransportBLE.observeState({
        next: ({ type }: { type: string; available: boolean }) => {
            latestBluetoothState = mapBluetoothState(type)
            for (const listener of listeners) listener(latestBluetoothState)
        },
        error: () => {},
        complete: () => {},
    })

    return listeners
}

/**
 * How long `connect` waits for the adapter's first state emission when it has
 * none yet. `observeState` answers in a few ms once the native manager is up;
 * this only bounds the pathological case so a cold-start sign can't stall.
 */
const BLUETOOTH_STATE_SETTLE_MS = 1000

/**
 * Resolves a definitive adapter state, subscribing if nothing has yet.
 *
 * Without this, a sign attempt in a process that never opened the pairing
 * screen (the common case — the only `observeBluetoothState` subscriber is that
 * screen) sees `unknown` and skips the Bluetooth-off check entirely, so a
 * disabled radio surfaced as a generic connection failure instead of "turn
 * Bluetooth on". Resolves `unknown` on timeout, which callers treat as "proceed
 * and let `open` fail" — the previous behavior, now only after we've waited.
 */
const resolveBluetoothState = async (): Promise<HardwareWalletAdapterState> => {
    if (latestBluetoothState !== 'unknown') return latestBluetoothState

    const listeners = ensureBluetoothObserver()
    if (!listeners) return latestBluetoothState

    return new Promise<HardwareWalletAdapterState>(resolve => {
        const settle = (state: HardwareWalletAdapterState) => {
            if (state === 'unknown') return
            clearTimeout(timer)
            listeners.delete(settle)
            resolve(state)
        }
        const timer = setTimeout(() => {
            listeners.delete(settle)
            resolve(latestBluetoothState)
        }, BLUETOOTH_STATE_SETTLE_MS)
        listeners.add(settle)
    })
}

/**
 * `useBlePermissions`' gate, callable from the non-React transport layer. iOS
 * needs no pre-flight — the Transport library prompts itself when scanning
 * begins and classifies a denial.
 *
 * CHECKS only, never prompts: the pairing flow already did, so a revocation at
 * sign time surfaces as a typed error for the UI to recover from.
 */
const hasBlePermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true

    const apiLevel = Number(Platform.Version)

    if (apiLevel >= 31) {
        const scanGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        )
        const connectGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        )
        return scanGranted && connectGranted
    }

    return PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    )
}

/**
 * React Native implementation of HardwareWalletService for Ledger BLE.
 * Uses @ledgerhq/react-native-hw-transport-ble for BLE communication
 * and @algorandfoundation/ledger-algorand-js for Algorand-specific APDU commands.
 */
export class RNLedgerService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    createTransportProvider(): LedgerTransportProvider {
        const { manufacturer } = this
        // Deliberately NOT starting the observer here: this runs at app start,
        // and creating the BLE manager that early asks iOS for Bluetooth
        // permission before the user has gone anywhere near Ledger. `connect`
        // subscribes on demand instead (see `resolveBluetoothState`).
        return {
            manufacturer,
            transportType: 'ble' as const,
            scan(
                onDevice: (device: LedgerDevice) => void,
                onError?: (error: Error) => void,
            ): () => void {
                const subscription = TransportBLE.listen({
                    next: (event: {
                        type: string
                        descriptor: {
                            id: string
                            name: string
                            serviceUUIDs: Nullable<string[]>
                            rssi: Nullable<number>
                        }
                    }) => {
                        if (event.type !== 'add') return

                        const { id, name, serviceUUIDs, rssi } =
                            event.descriptor
                        const model = resolveDeviceModel(serviceUUIDs)

                        onDevice({
                            id,
                            name:
                                name ||
                                `Ledger ${model.charAt(0).toUpperCase() + model.slice(1)}`,
                            manufacturer: 'ledger',
                            transportType: 'ble',
                            model,
                            rssi: rssi ?? null,
                        })
                    },
                    error: (err: unknown) => {
                        if (onError) {
                            onError(classifyLedgerError(err))
                        }
                    },
                    complete: () => {},
                })

                return () => subscription.unsubscribe()
            },

            async connect(deviceId: string): Promise<LedgerTransport> {
                // Reads the observed adapter state, NOT
                // `TransportBLE.isSupported()` — that only reports whether the
                // native module is linked and resolves true regardless of radio
                // state, so it can't detect a disabled radio.
                //
                // Blocks only on a definitive `poweredOff`. A state we still
                // don't know after `resolveBluetoothState` has waited falls
                // through to `open`, whose failure classifies on its own.
                if ((await resolveBluetoothState()) === 'poweredOff') {
                    throw new LedgerBluetoothDisabledError()
                }

                // Pre-flight: are scan + connect permissions granted? The
                // pairing flow already prompts for these — at sign time we
                // only check. If perms were revoked (or for some reason never
                // granted), throw so the overlay surfaces the "permission
                // required" preset with the troubleshooting link.
                const permitted = await hasBlePermissions()
                if (!permitted) {
                    throw new LedgerPermissionDeniedError()
                }

                // No pairing/bonding pre-check happens anywhere: iOS
                // doesn't expose bond state to apps, and Android's
                // BluetoothAdapter.bondedDevices is not consulted. Opening
                // the transport triggers the OS pairing prompt on demand.
                try {
                    const bleTransport = await TransportBLE.open(deviceId)
                    const algorandApp = new AlgorandApp(bleTransport)
                    return createLedgerTransportWrapper(
                        bleTransport,
                        algorandApp,
                    )
                } catch (error) {
                    throw classifyLedgerError(error)
                }
            },

            async isSupported(): Promise<boolean> {
                try {
                    // Reports whether the native BLE module is linked on this
                    // platform (true on iOS + Android). It does NOT reflect the
                    // adapter's on/off state — a disabled radio is handled at
                    // connect time and via the scan error classification.
                    return await TransportBLE.isSupported()
                } catch {
                    // The native BLE module may be absent (e.g. an environment
                    // where the extension isn't linked). Treat as unsupported
                    // rather than letting the rejection bubble up.
                    return false
                }
            },

            observeBluetoothState(
                onChange: (state: HardwareWalletAdapterState) => void,
            ): () => void {
                const listeners = ensureBluetoothObserver()
                // Emit the latest known state synchronously so the subscriber
                // doesn't have to wait for the next change to render.
                onChange(latestBluetoothState)
                if (!listeners) return () => {}
                listeners.add(onChange)
                return () => {
                    listeners.delete(onChange)
                }
            },

            async requestBluetoothEnable(): Promise<boolean> {
                const module = getNativeBluetoothModule()
                if (!module) return false
                try {
                    return await module.requestEnable()
                } catch {
                    // Native rejection (missing permission, no activity, etc.)
                    // — fall back to the in-app warning rather than throwing.
                    return false
                }
            },
        }
    }
}
