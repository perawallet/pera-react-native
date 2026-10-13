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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERA_CLIENT_META } from '../../shared/constants'
import { createWalletKitClient } from '../client'
import type { WalletConnectV2Storage } from '../storage'

const mocks = vi.hoisted(() => ({
    coreOptions: [] as unknown[],
    // Read at construction, which is when the library consults it.
    disableFlagAtConstruction: [] as (string | undefined)[],
    init: vi.fn(async () => ({ fake: 'walletkit' })),
}))

vi.mock('@walletconnect/core', () => ({
    EXPIRER_EVENTS: { expired: 'expirer_expired' },
    Core: class {
        constructor(options: unknown) {
            mocks.disableFlagAtConstruction.push(
                process.env.DISABLE_GLOBAL_CORE,
            )
            mocks.coreOptions.push(options)
        }
    },
}))

vi.mock('@reown/walletkit', () => ({
    WalletKit: { init: mocks.init },
}))

// `shared/constants` reads two caps off the signing barrel, which reaches
// react-native-mmkv; the rest of it is not on this path.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 1000,
    MAX_TRANSACTION_SIGN_REQUESTS: 1000,
}))

// Passed straight through to `Core`, so nothing here is ever read.
const storage: WalletConnectV2Storage = {
    getKeys: async () => [],
    getEntries: async () => [],
    getItem: async () => undefined,
    setItem: async () => {},
    removeItem: async () => {},
}

describe('createWalletKitClient', () => {
    beforeEach(() => {
        delete process.env.DISABLE_GLOBAL_CORE
        mocks.coreOptions.length = 0
        mocks.disableFlagAtConstruction.length = 0
        mocks.init.mockClear()
    })

    // Without the opt-out a re-initialize after teardown gets the first
    // Core back, relayer already closed, with a second engine bound to it.
    it('opts out of the process-global Core before constructing one', async () => {
        await createWalletKitClient({ projectId: 'project', storage })

        expect(mocks.disableFlagAtConstruction).toEqual(['true'])
        expect(mocks.coreOptions).toEqual([{ projectId: 'project', storage }])
    })

    it('hands the core and Pera metadata to WalletKit', async () => {
        const client = await createWalletKitClient({
            projectId: 'project',
            storage,
        })

        expect(mocks.init).toHaveBeenCalledWith({
            core: expect.any(Object),
            metadata: PERA_CLIENT_META,
        })
        expect(client).toEqual({ fake: 'walletkit' })
    })
})
