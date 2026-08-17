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

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

// Real `@algorandfoundation/react-native-keystore` executes native
// Keychain/Nitro bindings at import time, which jsdom can't run (see
// singleton.test.ts / createKeystore.spec.ts for the same mock).
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: (opts: { before?: Promise<unknown> }) => ({
        ready: Promise.resolve(opts.before).then(() => undefined),
    }),
    // Read by WithPeraKeystorePreflight when it builds its migration context.
    readMasterKey: vi.fn(),
    storage: {},
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import { memoryLedger } from '@algorandfoundation/provider-migrations'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import { createPeraKeystore } from '../keystore/createKeystore'
import { PeraProvider } from '../pera-provider'

describe('provider migrations wiring', () => {
    it('places WithMigrations first so later extensions can register', () => {
        // `register` is a no-op unless `provider.migrations` already exists,
        // and the Provider constructor applies extensions synchronously in
        // array order — so position 0 is load-bearing, not cosmetic.
        expect(PeraProvider.EXTENSIONS[0].name).toBe('WithMigrations')
    })

    // Ordering is the whole point of the preflight module and it fails
    // silently when wrong: modules run in registration order, registration
    // order is extension order, and nothing declares a dependency. Land it
    // after WithKeyStore and upstream's `adopt-flat-records` runs first,
    // overwriting `k/<rootId>` with the shadow's stripped metadata.
    it('registers WithPeraKeystorePreflight immediately before WithKeyStore', () => {
        const names = PeraProvider.EXTENSIONS.map(extension => extension.name)

        expect(names.indexOf('WithKeyStore')).toBe(
            names.indexOf('WithPeraKeystorePreflight') + 1,
        )
    })

    // The mirror image, and just as silent when wrong: the repair revisions
    // rewrite `k/` records that upstream's `adopt-flat-records` has not yet
    // produced, so landing this before WithKeyStore makes them a no-op on
    // exactly the records they exist to fix — with the ledger recording them
    // as applied, so they never run again.
    it('registers WithPeraKeystoreRepairs immediately after WithKeyStore', () => {
        const names = PeraProvider.EXTENSIONS.map(extension => extension.name)

        expect(names.indexOf('WithPeraKeystoreRepairs')).toBe(
            names.indexOf('WithKeyStore') + 1,
        )
    })

    it('exposes provider.migrations', () => {
        const provider = new PeraProvider(
            { id: 'test', name: 'Test' },
            { migrations: { ledger: memoryLedger() } },
        )

        expect(provider.migrations).toBeDefined()
    })

    it('does not hydrate the keystore before migrations resolve', async () => {
        const order: string[] = []
        const before = new Promise<void>(resolve => {
            setTimeout(() => {
                order.push('migrations')
                resolve()
            }, 0)
        })

        const keystore = createPeraKeystore({
            store: new Store<KeyStoreState>({ keys: [], status: 'idle' }),
            hooks: new Hook.Collection(),
            before,
        })
        await keystore.ready
        order.push('hydrated')

        expect(order).toEqual(['migrations', 'hydrated'])
    })

    // Documented on `ReactNativeKeyStoreOptions.before`: "A rejection
    // propagates to `ready`". A keystore whose data failed to migrate is not
    // one the app should read from.
    it('rejects keystore.ready when migrations fail', async () => {
        const before = Promise.reject(new Error('migration failed'))

        const keystore = createPeraKeystore({
            store: new Store<KeyStoreState>({ keys: [], status: 'idle' }),
            hooks: new Hook.Collection(),
            before,
        })

        await expect(keystore.ready).rejects.toThrow('migration failed')
    })
})
