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
import type {
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import {
    classifyLedgerError,
    createLedgerTransportWrapper,
} from '@perawallet/wallet-extension-ledger-shared'

/**
 * Maps a WebHID device's USB product ID to a friendly model name.
 * IDs from https://developers.ledger.com (vendor 0x2c97) — identical
 * mapping to RNLedgerUsbService's resolveModel.
 */
const resolveModel = (productId: number | undefined): string => {
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
 * WebHID's HIDDevice exposes no stable per-device id (unlike the RN HID
 * module's numeric deviceId) — identity is synthesized from vendorId +
 * productId, the same "advisory id" precedent RNLedgerUsbService already
 * documents for Android USB descriptors reassigned on replug.
 */
const deviceKey = (device: HIDDevice): string =>
    `${device.vendorId}:${device.productId}`

/**
 * Browser implementation of HardwareWalletService for Ledger USB (WebHID).
 * Uses @ledgerhq/hw-transport-webhid for USB communication and
 * @algorandfoundation/ledger-algorand-js for Algorand-specific APDU commands.
 */
export class LedgerWebUsbService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    // Populated during scan() so connect(id) can hand TransportWebHID.open()
    // the real HIDDevice object it requires — the platform-agnostic
    // interface only passes a string id.
    private readonly devicesByKey = new Map<string, HIDDevice>()

    createTransportProvider(): HardwareWalletTransportProvider {
        const { manufacturer, devicesByKey } = this
        return {
            manufacturer,
            transportType: 'usb',

            scan(onDevice, onError) {
                const subscription = TransportWebHID.listen({
                    next: event => {
                        if (event.type !== 'add') return
                        const device = event.descriptor
                        const key = deviceKey(device)
                        devicesByKey.set(key, device)
                        const model = resolveModel(device.productId)
                        onDevice({
                            id: key,
                            name: device.productName || `Ledger ${model}`,
                            manufacturer: 'ledger',
                            transportType: 'usb',
                            model,
                            rssi: null,
                        })
                    },
                    error: err => {
                        if (onError) onError(classifyLedgerError(err))
                    },
                    complete: () => {},
                })
                return () => subscription.unsubscribe()
            },

            async connect(deviceId: string): Promise<HardwareWalletTransport> {
                let cached = devicesByKey.get(deviceId)
                // `devicesByKey` only holds what THIS document scanned, and
                // scanning only ever happens in the Ledger connect/import
                // flow. Every other document — most importantly the approval
                // window, which is where dapp and WalletConnect signing runs
                // — starts with an empty cache. Falling straight through to
                // `request()` there asks for a WebHID permission prompt,
                // which requires transient user activation the signing
                // pipeline has already spent by the time it reaches connect,
                // so the connect rejected and the device was never asked to
                // sign. `list()` is `navigator.hid.getDevices()`: it returns
                // the devices this extension origin was already granted, and
                // needs no gesture.
                if (!cached) {
                    try {
                        const permitted = await TransportWebHID.list()
                        cached = permitted.find(
                            device => deviceKey(device) === deviceId,
                        )
                        if (cached) devicesByKey.set(deviceId, cached)
                    } catch {
                        // No navigator.hid at all — let the request() path
                        // below produce the real, classified error.
                    }
                }
                try {
                    let hidTransport: TransportWebHID
                    if (cached?.opened) {
                        // A transport from an earlier screen may not have
                        // closed cleanly by the time this screen reconnects
                        // the same cached device (e.g. a fire-and-forget
                        // disconnect() during unmount that hadn't finished) —
                        // TransportWebHID.open() throws "InvalidStateError:
                        // The device is already open" in that case. The
                        // device is still genuinely open and usable, so wrap
                        // it directly instead of reopening it.
                        hidTransport = new TransportWebHID(cached)
                    } else if (cached) {
                        hidTransport = await TransportWebHID.open(cached)
                    } else {
                        hidTransport = await TransportWebHID.request()
                    }
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
                    return await TransportWebHID.isSupported()
                } catch {
                    return false
                }
            },
        }
    }
}
