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

import { describe, expect, it, vi } from 'vitest'

// pera-provider.web.ts composes the real Ledger web-transport extensions and
// keystore-web's WithKeyStore (see pera-provider.web.test.ts for the same
// mocks) so the module can be imported under jsdom.
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
vi.mock('@algorandfoundation/keystore-web', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
}))

// Vitest has no `.web.ts` platform resolution, so importing the web provider
// pulls the *native* withPeraKeystorePreflight and with it the native keystore
// bindings. Ordering is identical in both siblings, which is what this asserts.
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: vi.fn(),
    storage: {},
}))
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

import { PeraProvider } from '../pera-provider.web'

describe('provider migrations wiring (web)', () => {
    it('places WithMigrations first so later extensions can register', () => {
        // Mirrors the native assertion in migrationsWiring.spec.ts: wrong
        // ordering is silent on both platforms — `provider.migrations` simply
        // never exists, and every `register` call no-ops with no error.
        expect(PeraProvider.EXTENSIONS[0].name).toBe('WithMigrations')
    })

    it('registers WithPeraKeystorePreflight immediately before WithKeyStore', () => {
        const names = PeraProvider.EXTENSIONS.map(extension => extension.name)

        expect(names.indexOf('WithKeyStore')).toBe(
            names.indexOf('WithPeraKeystorePreflight') + 1,
        )
    })

    it('registers WithPeraKeystoreRepairs immediately after WithKeyStore', () => {
        const names = PeraProvider.EXTENSIONS.map(extension => extension.name)

        expect(names.indexOf('WithPeraKeystoreRepairs')).toBe(
            names.indexOf('WithKeyStore') + 1,
        )
    })
})
