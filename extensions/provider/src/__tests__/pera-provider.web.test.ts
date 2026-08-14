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
import { memoryLedger } from '@algorandfoundation/provider-migrations'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'

// pera-provider.web.ts composes the real WithLedgerWebBleExtension /
// WithLedgerWebUsbExtension (no shim/rename), so their transport
// dependencies need the same mocks their own package tests use.
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

// This test asserts real registration into a real registry, so — unlike
// vitest.setup.ts's default mock — the platform extension here must expose
// a `hardwareWalletRegistry`, matching what the real platform-chrome /
// platform-react-native driver's `resources.ts` provides in production.
const hardwareWalletRegistry = createHardwareWalletRegistry()
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({ hardwareWalletRegistry }),
}))

// `storage`/`readMasterKey` are what WithPeraKeystorePreflight reads: vitest
// has no `.web.ts` resolution, so the web provider pulls the native sibling.
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    readMasterKey: vi.fn(),
    storage: {},
}))

// Ships untranspiled sources vitest can't parse; reached through the same
// native preflight sibling.
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@perawallet/wallet-extension-passkey-autofill', () => ({
    WithPasskeyAutofill: () => ({ passkeyAutofill: {} }),
}))

// Unmocked, this extension builds a real keystore-web engine whenever no
// `api.keystore` is injected, and its IndexedDB driver has no `globalThis
// .indexedDB` to open under vitest — an unhandled rejection rather than a
// failure, so it would poison the run without failing this test. The subject
// here is the Ledger registry.
vi.mock('@algorandfoundation/keystore-web', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
}))

import { PeraProvider } from '../pera-provider.web'

describe('pera-provider.web', () => {
    test('registers both a BLE and a USB Ledger transport provider into the hardware wallet registry', () => {
        expect(hardwareWalletRegistry.hasProvider('ledger', 'ble')).toBe(false)
        expect(hardwareWalletRegistry.hasProvider('ledger', 'usb')).toBe(false)

        // WithMigrations throws MissingLedgerError without one; a fresh
        // in-memory ledger is enough since this test never awaits a run.
        const provider = new PeraProvider(
            { id: 'test-web', name: 'Test Web Provider' },
            { migrations: { ledger: memoryLedger() } },
        )

        expect(provider).toBeInstanceOf(PeraProvider)
        expect(hardwareWalletRegistry.hasProvider('ledger', 'ble')).toBe(true)
        expect(hardwareWalletRegistry.hasProvider('ledger', 'usb')).toBe(true)

        const bleProvider = hardwareWalletRegistry.getProvider('ledger', 'ble')
        const usbProvider = hardwareWalletRegistry.getProvider('ledger', 'usb')
        expect(typeof bleProvider?.scan).toBe('function')
        expect(typeof usbProvider?.scan).toBe('function')
    })
})
