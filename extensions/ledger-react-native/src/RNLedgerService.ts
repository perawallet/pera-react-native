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

import { Platform, PermissionsAndroid } from 'react-native'
import type { HardwareWalletService } from '@perawallet/wallet-extension-platform'
import {
    hexToBytes,
    bytesToHex,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble'
import Algorand from '@ledgerhq/hw-app-algorand'
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
} from './errors'
import { resolveDeviceModel, buildLedgerAccountPath } from './constants'
import { extractLedgerSignature } from './signature'

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
    algorandApp: Algorand,
): LedgerTransport => ({
    async getAddress(
        accountIndex: number,
        verify = false,
    ): Promise<LedgerAccount> {
        try {
            const path = buildLedgerAccountPath(accountIndex)
            const result = await algorandApp.getAddress(path, verify)

            return {
                address: result.address,
                publicKey: hexToBytes(result.publicKey),
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
            const path = buildLedgerAccountPath(accountIndex)
            // hw-app-algorand.sign() expects a hex string message
            const hexMessage = bytesToHex(txnBytes)
            const result = await algorandApp.sign(path, hexMessage)
            return extractLedgerSignature(result.signature)
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
 * and @ledgerhq/hw-app-algorand for Algorand-specific APDU commands.
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
                // Pre-flight: is BLE turned on at the OS level?
                // TransportBLE.isSupported returns false when the platform
                // refuses to initialize the BLE module (typically because
                // Bluetooth is disabled). Throwing a typed error here lets
                // the overlay render the matching "enable Bluetooth" copy
                // instead of a generic connection failure.
                const bleSupported = await TransportBLE.isSupported().catch(
                    () => false,
                )
                if (!bleSupported) {
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

                // The pairing/bonding pre-check happens in the business
                // logic layer (`useLedgerPairing` + `useLedgerPairingStore`
                // in `@perawallet/wallet-core-ledger`). iOS doesn't expose
                // bond state to apps, so the check is implemented as a
                // "have we successfully paired with this deviceId before?"
                // heuristic instead of calling Android's
                // BluetoothAdapter.bondedDevices directly.
                try {
                    const bleTransport = await TransportBLE.open(deviceId)
                    const algorandApp = new Algorand(bleTransport)
                    return createTransportWrapper(bleTransport, algorandApp)
                } catch (error) {
                    throw classifyLedgerError(error)
                }
            },

            async isSupported(): Promise<boolean> {
                try {
                    return await TransportBLE.isSupported()
                } catch {
                    // The native BLE module may be missing or refuse to
                    // initialize on environments where Bluetooth is
                    // disabled at the OS level. Treat as unsupported
                    // rather than letting the rejection bubble up.
                    return false
                }
            },
        }
    }
}
