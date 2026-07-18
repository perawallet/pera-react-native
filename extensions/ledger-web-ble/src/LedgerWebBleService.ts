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
    HardwareWalletAdapterState,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import BluetoothTransport from '@ledgerhq/hw-transport-web-ble'
import { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import {
    classifyLedgerError,
    createLedgerTransportWrapper,
} from '@perawallet/wallet-extension-ledger-react-native/protocol'

type WebBluetoothDevice = { id: string; name?: string }

/**
 * Web Bluetooth device objects expose no advertised service UUIDs before
 * connecting (privacy restriction of the spec) — `resolveDeviceModel`
 * (used by the native BLE package) needs a service UUID we don't have at
 * scan time, so the model is instead guessed from the device's advertised
 * name, matching Ledger's own naming convention (e.g. "Nano X 1234",
 * "Stax 1234"). Defaults to 'nanoX', mirroring resolveDeviceModel's own
 * fallback for an unrecognized UUID.
 */
const resolveModelFromName = (name: string | undefined): string => {
    const lower = (name ?? '').toLowerCase()
    if (lower.includes('stax')) return 'stax'
    if (lower.includes('flex')) return 'flex'
    return 'nanoX'
}

/**
 * Browser implementation of HardwareWalletService for Ledger BLE (Web
 * Bluetooth). @ledgerhq/hw-transport-web-ble's `listen()` triggers the
 * browser's native device chooser and emits AT MOST ONE device (the one
 * the user picked) — unlike the RN BLE transport's continuous multi-device
 * scan stream. `connect()` reuses the raw BluetoothDevice object captured
 * during scan so the library's `open()` skips its string-id branch (which
 * would otherwise re-trigger the picker) and reconnects to the
 * already-chosen device directly.
 */
export class LedgerWebBleService implements HardwareWalletService {
    manufacturer = 'ledger' as const

    private readonly devicesById = new Map<string, WebBluetoothDevice>()

    createTransportProvider(): HardwareWalletTransportProvider {
        const { manufacturer, devicesById } = this
        return {
            manufacturer,
            transportType: 'ble',

            scan(onDevice, onError) {
                const subscription = BluetoothTransport.listen({
                    next: (event: {
                        type: string
                        descriptor: WebBluetoothDevice
                    }) => {
                        if (event.type !== 'add') return
                        const device = event.descriptor
                        devicesById.set(device.id, device)
                        const model = resolveModelFromName(device.name)
                        onDevice({
                            id: device.id,
                            name: device.name || `Ledger ${model}`,
                            manufacturer: 'ledger',
                            transportType: 'ble',
                            model,
                            rssi: null,
                        })
                    },
                    error: (err: unknown) => {
                        if (onError) onError(classifyLedgerError(err))
                    },
                    complete: () => {},
                })
                return () => subscription.unsubscribe()
            },

            async connect(deviceId: string): Promise<HardwareWalletTransport> {
                const cached = devicesById.get(deviceId)
                try {
                    const bleTransport = await BluetoothTransport.open(
                        cached ?? deviceId,
                    )
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
                    return await BluetoothTransport.isSupported()
                } catch {
                    return false
                }
            },

            observeBluetoothState(
                onChange: (state: HardwareWalletAdapterState) => void,
            ): () => void {
                const subscription = BluetoothTransport.observeAvailability({
                    next: (available: boolean) => {
                        onChange(available ? 'poweredOn' : 'poweredOff')
                    },
                    error: () => onChange('unsupported'),
                    complete: () => {},
                })
                return () => subscription.unsubscribe()
            },

            async requestBluetoothEnable(): Promise<boolean> {
                // No web equivalent of the Android "enable Bluetooth" intent
                // — matches the existing iOS no-native-module fallback.
                return false
            },
        }
    }
}
