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

import type { HardwareWalletService } from '@perawallet/wallet-extension-platform'
import type {
    LedgerTransportProvider,
    LedgerTransport,
    LedgerDevice,
    LedgerAccount,
} from '@perawallet/wallet-core-ledger'
import {
    resolveDeviceModel,
    buildLedgerAccountPath,
    classifyLedgerError,
    LedgerConnectionError,
} from '@perawallet/wallet-core-ledger'
import {
    hexToBytes,
    bytesToHex,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble'
import Algorand from '@ledgerhq/hw-app-algorand'

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

            if (!result.signature) {
                throw new LedgerConnectionError(
                    'Signing returned empty signature',
                )
            }

            return Uint8Array.from(result.signature)
        } catch (error) {
            // Re-throw already-classified errors
            if (error instanceof LedgerConnectionError) {
                throw error
            }
            throw classifyLedgerError(error)
        }
    },

    async disconnect(): Promise<void> {
        await bleTransport.close()
    },
})

/**
 * React Native implementation of LedgerService using BLE transport.
 * Uses @ledgerhq/react-native-hw-transport-ble for BLE communication
 * and @ledgerhq/hw-app-algorand for Algorand-specific APDU commands.
 */
export class RNLedgerService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    createTransportProvider(): LedgerTransportProvider {
        const { manufacturer } = this
        return {
            manufacturer,
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
                            model,
                            rssi: rssi ?? null,
                        })
                    },
                    error: (err: unknown) => {
                        if (onError) {
                            const classified =
                                err instanceof Error
                                    ? classifyLedgerError(err)
                                    : new LedgerConnectionError(String(err))
                            onError(classified)
                        }
                    },
                    complete: () => {},
                })

                return () => subscription.unsubscribe()
            },

            async connect(deviceId: string): Promise<LedgerTransport> {
                // TODO(PERA-ledger): add pre-connect bonding/pairing check
                // to match Android's LedgerBleOperationManager.isBondingRequired
                // — if unbonded, route to LedgerTroubleshootingScreen with
                // pairing instructions instead of surfacing a generic BLE
                // error after connect fails.
                try {
                    const bleTransport = await TransportBLE.open(deviceId)
                    const algorandApp = new Algorand(bleTransport)
                    return createTransportWrapper(bleTransport, algorandApp)
                } catch (error) {
                    throw classifyLedgerError(error)
                }
            },

            async isSupported(): Promise<boolean> {
                return TransportBLE.isSupported()
            },
        }
    }
}
