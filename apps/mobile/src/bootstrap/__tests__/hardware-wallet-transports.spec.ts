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

import { describe, test, expect, vi } from 'vitest'
import {
    createHardwareWalletRegistry,
    type HardwareWalletRegistry,
} from '@perawallet/wallet-extension-hardware-wallet'

// The real native transports load BLE/HID native modules jsdom can't parse,
// so each stands in with one that registers what the real one would. Both
// packages alias to one stub file in vitest.config.ts, so both mocks must
// carry both exports.
const fakeLedgerExtensions = vi.hoisted(() => {
    const registering =
        (transportType: 'ble' | 'usb') =>
        (provider: { hardwareWalletRegistry: HardwareWalletRegistry }) => {
            provider.hardwareWalletRegistry.register({
                manufacturer: 'ledger',
                transportType,
                scan: () => () => {},
                connect: async () => {
                    throw new Error('not connectable in tests')
                },
                isSupported: async () => true,
            })
            return {}
        }
    return {
        WithLedgerExtension: registering('ble'),
        WithLedgerUsbExtension: registering('usb'),
    }
})
vi.mock(
    '@perawallet/wallet-extension-ledger-react-native',
    () => fakeLedgerExtensions,
)
vi.mock(
    '@perawallet/wallet-extension-ledger-react-native-usb',
    () => fakeLedgerExtensions,
)

import { registerHardwareWalletTransports } from '../hardware-wallet-transports'

describe('registerHardwareWalletTransports (native)', () => {
    test('registers a BLE and a USB Ledger transport into the given registry', () => {
        const registry = createHardwareWalletRegistry()

        registerHardwareWalletTransports(registry)

        expect(registry.hasProvider('ledger', 'ble')).toBe(true)
        expect(registry.hasProvider('ledger', 'usb')).toBe(true)
    })
})
