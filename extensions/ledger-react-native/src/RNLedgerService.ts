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

import { Buffer } from 'buffer'
import { requireOptionalNativeModule } from 'expo'
import { Platform, PermissionsAndroid } from 'react-native'
import type { HardwareWalletService } from '@perawallet/wallet-extension-platform'
import { type Nullable } from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletAdapterState,
    HardwareWalletArbitrarySignRequest,
} from '@perawallet/wallet-core-hardware-wallet'
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble'
import { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import type {
    LedgerTransportProvider,
    LedgerTransport,
    LedgerDevice,
    LedgerAccount,
} from './types'
import {
    classifyLedgerError,
    LedgerBluetoothDisabledError,
    LedgerPermissionDeniedError,
    LedgerSigningError,
} from './errors'
import { resolveDeviceModel, buildLedgerAccountPath } from './constants'

/**
 * Map the underlying ble-plx / CoreBluetooth state string emitted by
 * `TransportBLE.observeState` onto our platform-agnostic adapter state.
 * Unrecognized values fall back to `unknown`.
 */
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
 * Expo local module (`apps/mobile/native-modules/bluetooth`) that surfaces the OS
 * "turn on Bluetooth" prompt. Absent in unit tests and any build where the
 * module isn't linked, so access is guarded (`requireOptionalNativeModule`
 * returns null when unlinked).
 */
interface NativePeraBluetooth {
    requestEnable(): Promise<boolean>
}

const getNativeBluetoothModule = (): NativePeraBluetooth | null =>
    requireOptionalNativeModule<NativePeraBluetooth>('PeraBluetooth')

/**
 * Shared Bluetooth adapter-state observer.
 *
 * `TransportBLE.observeState` registers a state listener on the underlying
 * BLE manager but returns a no-op `unsubscribe` (the lib never detaches it).
 * To avoid leaking a fresh, un-removable listener on every screen mount, we
 * attach exactly one underlying observer at module scope and fan its updates
 * out to our own set of subscribers. Subscribers add/remove freely; the
 * underlying observer is created lazily on first use and then lives for the
 * process lifetime (matching the lib's behavior anyway).
 */
let bluetoothStateListeners: Nullable<Set<BluetoothStateListener>> = null
let latestBluetoothState: HardwareWalletAdapterState = 'unknown'

const ensureBluetoothObserver = (): Set<BluetoothStateListener> => {
    if (bluetoothStateListeners) return bluetoothStateListeners

    const listeners = new Set<BluetoothStateListener>()
    bluetoothStateListeners = listeners

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
 * Pre-flight check that BLE scan + connect permissions are granted at sign time
 * (Android API ≥ 31 requires both BLUETOOTH_SCAN and BLUETOOTH_CONNECT).
 * Mirrors the gate in `useBlePermissions` but is callable from the
 * non-React transport layer.
 *
 * iOS does not require pre-flighting: the Transport library handles the
 * CoreBluetooth permission prompt automatically when scanning begins and
 * surfaces a classified error if the user denies it.
 *
 * This only CHECKS — it does not prompt. The pairing flow already
 * prompts for these permissions; if they're revoked at sign time we
 * surface a typed error and the UI handles the recovery.
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
 * Wraps a connected Ledger BLE transport + Algorand app instance
 * into the platform-agnostic LedgerTransport interface.
 */
const createTransportWrapper = (
    bleTransport: TransportBLE,
    algorandApp: AlgorandApp,
): LedgerTransport => ({
    async getAddress(
        accountIndex: number,
        verify = false,
    ): Promise<LedgerAccount> {
        try {
            const result = await algorandApp.getAddressAndPubKey(
                accountIndex,
                verify,
            )
            return {
                address: result.address.toString(),
                publicKey: Uint8Array.from(result.publicKey),
                accountIndex,
            }
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async signTransaction(
        accountIndex: number,
        txnBytes: Uint8Array,
    ): Promise<Uint8Array> {
        try {
            // AlgorandApp.sign decodes a string message as UTF-8, so the
            // msgpack bytes MUST be passed as a Buffer. The library strips the
            // trailing status word, so the returned signature is already clean.
            const result = await algorandApp.sign(
                accountIndex,
                Buffer.from(txnBytes),
            )
            const signature = Uint8Array.from(result.signature)
            if (signature.length === 0) {
                throw new LedgerSigningError('Empty signature returned')
            }
            return signature
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async getAppVersion() {
        try {
            const { major, minor, patch } = await algorandApp.getVersion()
            return { major, minor, patch }
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async signData(
        request: HardwareWalletArbitrarySignRequest,
    ): Promise<Uint8Array> {
        try {
            const result = await algorandApp.signData(
                {
                    data: request.data,
                    signer: request.signerPublicKey,
                    domain: request.domain,
                    // Library field is spelled `authenticationData`.
                    authenticationData: request.authenticatorData,
                    requestId: request.requestId,
                    hdPath: buildLedgerAccountPath(request.accountIndex),
                },
                { scope: request.scope, encoding: request.encoding },
            )
            const signature = Uint8Array.from(result.signature)
            if (signature.length === 0) {
                throw new LedgerSigningError('Empty signature returned')
            }
            return signature
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async disconnect(): Promise<void> {
        await bleTransport.close()
    },
})

/**
 * React Native implementation of HardwareWalletService for Ledger BLE.
 * Uses @ledgerhq/react-native-hw-transport-ble for BLE communication
 * and @algorandfoundation/ledger-algorand-js for Algorand-specific APDU commands.
 */
export class RNLedgerService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    createTransportProvider(): LedgerTransportProvider {
        const { manufacturer } = this
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
                // Pre-flight: is Bluetooth powered on at the OS level?
                // NOTE: `TransportBLE.isSupported()` only reports whether the
                // native BLE module is linked — it resolves `true` whenever the
                // module is bundled, regardless of adapter state — so it can
                // NOT detect a disabled radio (the previous check here was dead
                // code). Read the observed adapter state instead: the scan
                // screen keeps the shared observer running, so by connect time
                // it reflects the real state. Only block on a definitive
                // `poweredOff`; `unknown` (no observer yet, e.g. cold-start
                // signing) falls through to `TransportBLE.open`, whose failure
                // is classified as a generic connection error — the ble-plx
                // "powered off" (102) → typed-error mapping only applies to the
                // scan path (`listen`), not `open`.
                if (latestBluetoothState === 'poweredOff') {
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
                    return createTransportWrapper(bleTransport, algorandApp)
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
