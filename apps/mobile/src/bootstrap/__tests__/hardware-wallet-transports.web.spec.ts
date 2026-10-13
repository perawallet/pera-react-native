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

import { describe, test, expect, vi, afterEach } from 'vitest'
import {
    createHardwareWalletRegistry,
    ledgerAppDriverRegistry,
} from '@perawallet/wallet-extension-hardware-wallet'
import { LedgerDevicePickerUnavailableError } from '@perawallet/wallet-core-ledger'

// The real Web Bluetooth / WebHID extensions run here; only the browser
// transport libraries beneath them are stubbed.
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

import { registerHardwareWalletTransports } from '../hardware-wallet-transports.web'

const setSurface = (surface: string | undefined) => {
    ;(globalThis as { __PERA_SURFACE__?: string }).__PERA_SURFACE__ = surface
}

describe('registerHardwareWalletTransports (web)', () => {
    afterEach(() => {
        setSurface(undefined)
    })

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

    test('refuses a Bluetooth connect that needs a picker from the toolbar popup', async () => {
        setSurface('popup')
        ledgerAppDriverRegistry.reset()
        ledgerAppDriverRegistry.register({ chainId: 'test', open: vi.fn() })
        const registry = createHardwareWalletRegistry()
        registerHardwareWalletTransports(registry)

        await expect(
            registry.getProvider('ledger', 'ble')?.connect('paired-elsewhere'),
        ).rejects.toBeInstanceOf(LedgerDevicePickerUnavailableError)
    })
})
