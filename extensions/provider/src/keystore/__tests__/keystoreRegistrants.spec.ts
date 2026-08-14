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
import type { MigrationModule } from '@algorandfoundation/provider-migrations'

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

// The package root runs native Keychain/Nitro bindings at import time.
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: vi.fn(),
    storage: {
        getString: () => undefined,
        set: () => {},
        remove: () => {},
        getAllKeys: () => [],
    },
}))

import type { PeraMigrationContext } from '../migrations/types'
import { PREFLIGHT_MODULE_ID } from '../migrations/preflight'
import { REPAIRS_MODULE_ID } from '../migrations/repairs'
import { WithPeraKeystorePreflight } from '../withPeraKeystorePreflight'
import { WithPeraKeystoreRepairs } from '../withPeraKeystoreRepairs'
import { fakeStorage } from '../migrations/__fixtures__/fakeStorage'

type Extension = (
    provider: { migrations: { register: (m: MigrationModule) => void } },
    options: { keystore: { storage: ReturnType<typeof fakeStorage> } },
) => unknown

const registerWith = async (extension: Extension) => {
    const keystore = fakeStorage({})
    let registered: MigrationModule | undefined

    extension(
        {
            migrations: {
                register: (module: MigrationModule) => {
                    registered = module
                },
            },
        },
        { keystore: { storage: keystore } },
    )

    return {
        keystore,
        module: registered!,
        context: (await registered!.context()) as PeraMigrationContext,
    }
}

describe.each([
    [
        'WithPeraKeystorePreflight',
        WithPeraKeystorePreflight,
        PREFLIGHT_MODULE_ID,
    ],
    ['WithPeraKeystoreRepairs', WithPeraKeystoreRepairs, REPAIRS_MODULE_ID],
])('%s', (_name, extension, moduleId) => {
    it('registers under its permanent module id', async () => {
        const { module } = await registerWith(extension as unknown as Extension)

        expect(module.module).toBe(moduleId)
    })

    // The note store must be the migrations ledger's MMKV instance, never the
    // keystore's: canary.19 mints the Keychain master key only while the
    // keystore store is literally empty, so a note written there would block the
    // first write forever and a fresh install could never create an account.
    // Only a comment stands between the wiring and that mistake otherwise.
    it('does not back the declined register with the keystore storage', async () => {
        const { keystore, context } = await registerWith(
            extension as unknown as Extension,
        )

        context.declined.record(moduleId, ['some-record'])

        expect(keystore.entries()).toEqual({})
        expect(context.declined.read(moduleId)).toEqual(['some-record'])
    })

    it('points the context at the keystore storage it was given', async () => {
        const { keystore, context } = await registerWith(
            extension as unknown as Extension,
        )

        expect(context.storage).toBe(keystore)
    })
})
