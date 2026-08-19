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

import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_LEDGER_KEY } from '@algorandfoundation/provider-migrations'
import {
    peraMigrationNoteStore,
    readKeystoreMigrationLedger,
    resetKeystoreMigrationModule,
} from '../migrationsLedger'

const PREFLIGHT = 'com.perawallet.wallet/keystore-preflight'
const UPSTREAM = '@algorandfoundation/react-native-keystore'
const REPAIRS = 'com.perawallet.wallet/keystore-repairs'

const rev = (id: number, name: string) => ({
    id,
    name,
    appliedAt: '2026-08-14T00:00:00.000Z',
})

const seed = (map: Record<string, unknown>) =>
    peraMigrationNoteStore().set(DEFAULT_LEDGER_KEY, JSON.stringify(map))

beforeEach(() => {
    // Isolate tests: the mocked MMKV instance is shared across a file.
    // (`remove` is the real react-native-mmkv v4 method and the only deletion
    // method the provider's vitest MMKV mock implements — not `delete`/`clearAll`.)
    peraMigrationNoteStore().remove(DEFAULT_LEDGER_KEY)
})

describe('readKeystoreMigrationLedger', () => {
    it('returns an empty map when the ledger is absent', () => {
        expect(readKeystoreMigrationLedger()).toEqual({})
    })

    it('returns an empty map when the ledger blob is unparseable', () => {
        peraMigrationNoteStore().set(DEFAULT_LEDGER_KEY, 'not-json{')
        expect(readKeystoreMigrationLedger()).toEqual({})
    })

    it('reads the recorded revision for each module', () => {
        seed({ [REPAIRS]: rev(3, 'mint-passkey-main-key') })
        expect(readKeystoreMigrationLedger()[REPAIRS]).toMatchObject({
            id: 3,
            name: 'mint-passkey-main-key',
        })
    })
})

describe('resetKeystoreMigrationModule', () => {
    it('removes only the target module, leaving the others intact', () => {
        seed({
            [PREFLIGHT]: rev(4, 'adopt-material-less-records'),
            [UPSTREAM]: rev(2, 'adopt-flat-records'),
            [REPAIRS]: rev(3, 'mint-passkey-main-key'),
        })

        resetKeystoreMigrationModule(REPAIRS)

        const after = readKeystoreMigrationLedger()
        expect(after[REPAIRS]).toBeUndefined()
        expect(after[PREFLIGHT]?.id).toBe(4)
        expect(after[UPSTREAM]?.id).toBe(2)
    })

    it('is a no-op when the module is not recorded', () => {
        seed({ [PREFLIGHT]: rev(4, 'adopt-material-less-records') })
        expect(() => resetKeystoreMigrationModule(REPAIRS)).not.toThrow()
        expect(readKeystoreMigrationLedger()[PREFLIGHT]?.id).toBe(4)
    })
})
