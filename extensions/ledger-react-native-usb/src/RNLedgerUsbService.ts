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
import {
    hexToBytes,
    bytesToHex,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import TransportHID from '@ledgerhq/react-native-hid'
import Algorand from '@ledgerhq/hw-app-algorand'
import {
    classifyLedgerError,
    LedgerConnectionError,
    LedgerSigningError,
    buildLedgerAccountPath,
} from '@perawallet/wallet-extension-ledger-react-native/protocol'

/**
 * Wraps a connected Ledger HID (USB) transport + Algorand app instance
 * into the platform-agnostic HardwareWalletTransport interface.
 */
const createTransportWrapper = (
    hidTransport: TransportHID,
    algorandApp: Algorand,
): HardwareWalletTransport => ({
    async getAddress(accountIndex, verify = false) {
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

    async signTransaction(accountIndex, txnBytes) {
        try {
            const path = buildLedgerAccountPath(accountIndex)
            const hexMessage = bytesToHex(txnBytes)
            const result = await algorandApp.sign(path, hexMessage)

            if (!result.signature) {
                throw new LedgerSigningError('Empty signature returned')
            }
            return Uint8Array.from(result.signature)
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async disconnect() {
        await hidTransport.close()
    },
})

type LedgerHIDDescriptor = {
    deviceId?: number | string
    productId?: number
    vendorId?: number
    deviceName?: Nullable<string>
}

/**
 * Maps a HID descriptor product ID to a friendly model name.
 * IDs from https://developers.ledger.com (vendor 0x2C97).
 */
const resolveModel = (productId: Nullable<number>): string => {
    switch (productId) {
        case 0x0001:
            return 'nanoS'
        case 0x0004:
            return 'nanoX'
        case 0x4011:
            return 'nanoSPlus'
        case 0x6011:
            return 'stax'
        case 0x7011:
            return 'flex'
        default:
            return 'ledger'
    }
}

/**
 * React Native implementation of HardwareWalletService for Ledger USB (Android).
 * Uses @ledgerhq/react-native-hid for USB host communication and
 * @ledgerhq/hw-app-algorand for Algorand-specific APDU commands.
 *
 * iOS: TransportHID.isSupported() throws because the native module is
 * Android-only — the catch block in isSupported() returns false there,
 * so consumers naturally skip this provider on iOS.
 */
export class RNLedgerUsbService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    createTransportProvider(): HardwareWalletTransportProvider {
        const { manufacturer } = this
        return {
            manufacturer,
            transportType: 'usb',

            scan(
                onDevice: (device: HardwareWalletDevice) => void,
                onError?: (error: Error) => void,
            ): () => void {
                const subscription = TransportHID.listen({
                    next: (event: {
                        type: string
                        descriptor: LedgerHIDDescriptor
                    }) => {
                        if (event.type !== 'add') return
                        const { deviceId, productId, deviceName } =
                            event.descriptor
                        const model = resolveModel(productId ?? null)
                        // deviceId is the stable handle from the HID
                        // descriptor; productId is the same across all
                        // Ledger devices of the same model. If neither
                        // is present we skip the descriptor rather than
                        // emit a sentinel that would alias multiple
                        // devices in the connection-routing map.
                        const id = deviceId ?? productId
                        if (id === undefined) return
                        onDevice({
                            id: String(id),
                            name: deviceName || `Ledger ${model}`,
                            manufacturer: 'ledger',
                            transportType: 'usb',
                            model,
                            rssi: null,
                        })
                    },
                    error: (err: unknown) => {
                        if (!onError) return
                        onError(classifyLedgerError(err))
                    },
                    complete: () => {},
                })
                return () => subscription.unsubscribe()
            },

            // Android USB device IDs are reassigned on replug and lost on app
            // restart, so the deviceId stored on an imported account is not a
            // stable handle. The native HID.openDevice looks the device up by
            // vendorId only — so connecting just means opening whichever
            // Ledger is currently plugged in.
            async connect(): Promise<HardwareWalletTransport> {
                const [device] = await TransportHID.list()
                if (!device) {
                    throw new LedgerConnectionError(
                        'No Ledger connected over USB.',
                    )
                }
                try {
                    const hidTransport = await TransportHID.open(device)
                    const algorandApp = new Algorand(hidTransport)
                    return createTransportWrapper(hidTransport, algorandApp)
                } catch (error) {
                    throw classifyLedgerError(error)
                }
            },

            async isSupported(): Promise<boolean> {
                try {
                    return await TransportHID.isSupported()
                } catch {
                    // The HID native module is Android-only; on iOS it is
                    // absent entirely and the call throws. Treat as unsupported.
                    return false
                }
            },
        }
    }
}
