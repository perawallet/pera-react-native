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
import { storage as keystoreStorage } from '@algorandfoundation/react-native-keystore'
import {
    createPeraMigrationLedger,
    PERA_MIGRATIONS_MMKV_ID,
} from '../migrationsLedger'

// Real `@algorandfoundation/react-native-keystore` executes native
// Keychain/Nitro bindings at import time, which jsdom can't run — every spec
// in this package that touches it mocks the whole module (see
// createKeystore.spec.ts, singleton.test.ts). `storage` is rebuilt from the
// same mocked `react-native-mmkv` factory (see vitest.setup.ts) under the
// package's real "keystore" instance id, so this test still exercises actual
// per-id isolation rather than two independently-faked stores.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const { createMMKV } = await import('react-native-mmkv')
    return { storage: createMMKV({ id: 'keystore' }) }
})

describe('createPeraMigrationLedger', () => {
    it('never writes into the keystore MMKV instance', async () => {
        const before = keystoreStorage.getAllKeys()

        const ledger = createPeraMigrationLedger()
        await ledger.write('com.perawallet.wallet/keystore-preflight', {
            id: 1,
            name: 'retire-hd-root-shadow',
            appliedAt: '2026-08-14T00:00:00.000Z',
        })

        expect(keystoreStorage.getAllKeys()).toEqual(before)
    })

    it('round-trips a revision', async () => {
        const ledger = createPeraMigrationLedger()
        await ledger.write('mod', {
            id: 2,
            name: 'second',
            appliedAt: '2026-08-14T00:00:00.000Z',
        })

        await expect(ledger.read()).resolves.toMatchObject({
            mod: { id: 2, name: 'second' },
        })
    })

    it('uses a dedicated instance id', () => {
        expect(PERA_MIGRATIONS_MMKV_ID).toBe('pera-provider-migrations')
    })
})
