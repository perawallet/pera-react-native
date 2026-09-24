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
import { createHardwareWalletRegistry } from '@perawallet/wallet-extension-hardware-wallet'

// The real Web Bluetooth / WebHID extensions run here; only the browser
// transport libraries and the Ledger app client beneath them are stubbed.
vi.mock('@ledgerhq/hw-transport-web-ble', () => ({
    default: {
        listen: vi.fn(),
        open: vi.fn(),
        isSupported: vi.fn(),
        observeAvailability: vi.fn(),
    },
}))
vi.mock('@ledgerhq/hw-transport-webhid', () => ({
    default: {
        listen: vi.fn(),
        open: vi.fn(),
        isSupported: vi.fn(),
        request: vi.fn(),
    },
}))
vi.mock('@algorandfoundation/ledger-algorand-js', () => ({
    AlgorandApp: class {
        getAddressAndPubKey = vi.fn()
        sign = vi.fn()
        getVersion = vi.fn()
        signData = vi.fn()
    },
}))

import { registerHardwareWalletTransports } from '../hardware-wallet-transports.web'

describe('registerHardwareWalletTransports (web)', () => {
    test('registers a BLE and a USB Ledger transport into the given registry', () => {
        const registry = createHardwareWalletRegistry()

        registerHardwareWalletTransports(registry)

        expect(typeof registry.getProvider('ledger', 'ble')?.scan).toBe(
            'function',
        )
        expect(typeof registry.getProvider('ledger', 'usb')?.scan).toBe(
            'function',
        )
    })
})
