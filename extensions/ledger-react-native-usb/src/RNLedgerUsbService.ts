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

import type { HardwareWalletService } from '@perawallet/wallet-extension-platform'
import { type Nullable } from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import TransportHID from '@ledgerhq/react-native-hid'
import { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import {
    classifyLedgerError,
    LedgerUsbMultipleDevicesError,
    LedgerUsbNoDeviceError,
    createLedgerTransportWrapper,
} from '@perawallet/wallet-extension-ledger-shared'

type LedgerHIDDescriptor = {
    deviceId?: number | string
    productId?: number
    vendorId?: number
    deviceName?: Nullable<string>
}

/**
 * Identifier for a HID descriptor, matching the id `scan` surfaces so a
 * deviceId stored on an account can be matched back to a live descriptor in
 * `connect`. Uses the descriptor's deviceId when present, falling back to the
 * (model-wide) productId. Android USB ids are reassigned on replug and lost on
 * app restart, so this is not a durable handle — `connect` treats a non-match
 * as "id unknown" rather than a hard failure.
 */
const descriptorId = (descriptor: LedgerHIDDescriptor): string | undefined => {
    const id = descriptor.deviceId ?? descriptor.productId
    return id === undefined ? undefined : String(id)
}

/**
 * Maps a HID descriptor product ID to a friendly model name.
 * IDs from https://developers.ledger.com (vendor 0x2C97).
 */
const resolveModel = (productId: Nullable<number>): string => {
    switch (productId) {
        case 0x00_01: {
            return 'nanoS'
        }
        case 0x00_04: {
            return 'nanoX'
        }
        case 0x40_11: {
            return 'nanoSPlus'
        }
        case 0x60_11: {
            return 'stax'
        }
        case 0x70_11: {
            return 'flex'
        }
        default: {
            return 'ledger'
        }
    }
}

/**
 * React Native implementation of HardwareWalletService for Ledger USB (Android).
 * Uses @ledgerhq/react-native-hid for USB host communication and
 * @algorandfoundation/ledger-algorand-js for Algorand-specific APDU commands.
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
                        const { productId, deviceName } = event.descriptor
                        const model = resolveModel(productId ?? null)
                        // If neither deviceId nor productId is present we skip
                        // the descriptor rather than emit a sentinel that would
                        // alias multiple devices in the connection-routing map.
                        const id = descriptorId(event.descriptor)
                        if (id === undefined) return
                        onDevice({
                            id,
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

            // Connect to the sole attached Ledger. The native Android HID
            // module (@ledgerhq/react-native-hid) selects a device by vendorId
            // ALONE — `openDevice` reads only `vendorId` and opens the first
            // match, ignoring productId/deviceId. Every Ledger shares one
            // vendorId, so with more than one attached we cannot target a
            // specific device and could open (and sign with) the wrong one.
            // We therefore connect only when exactly one Ledger is present and
            // refuse otherwise. `deviceId` is advisory per the interface and
            // cannot influence which physical device the native layer opens.
            async connect(
                _deviceId?: string,
            ): Promise<HardwareWalletTransport> {
                const descriptors = await TransportHID.list()
                if (descriptors.length === 0) {
                    throw new LedgerUsbNoDeviceError()
                }

                if (descriptors.length > 1) {
                    throw new LedgerUsbMultipleDevicesError()
                }

                try {
                    const hidTransport = await TransportHID.open(descriptors[0])
                    const algorandApp = new AlgorandApp(hidTransport)
                    return createLedgerTransportWrapper(
                        hidTransport,
                        algorandApp,
                    )
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
