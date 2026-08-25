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

import { vi } from 'vitest'

// The submission chokepoint (packages/signing/pipeline/submission) reaches
// `@perawallet/wallet-core-blockchain`'s network/accounts stores for their
// persisted state, and those stores resolve storage through
// `getProvider().keyValueStorage`. The real provider pulls in RN-native
// modules (react-native-mmkv) that cannot load under Node, so — same as
// packages/signing's own vitest.setup.ts — swap in an in-memory stand-in.
// This mocks platform storage only; algod itself is never mocked.
const store = new Map<string, string>()

// The app's own signer (`signTransactionsWithLocalKey`) imports the accounts
// barrel for its three account-type guards, and the barrel drags every
// accounts hook (multisig, staking, currencies) along with them — none of
// which is reachable from a Node suite.
//
// This re-exports the barrel's hook-free modules for real and stubs only the
// store the submission chokepoint reads. It is deliberately NOT the whole
// barrel: `./hooks`, `./db`, `./sync`, `./store`, `./account-discovery`,
// `./cleanup`, `./import-session` and `./device-accounts` are absent, so a
// suite that starts importing one of those from the barrel gets `undefined`
// at use rather than an import error. Add the module here when that happens
// — do not reach for `importActual` of the barrel itself, which is the graph
// this mock exists to avoid.
vi.mock('@perawallet/wallet-core-accounts', async () => {
    const [models, utils, constants, errors, bip44] = await Promise.all([
        vi.importActual<object>('@perawallet/wallet-core-accounts/models'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/utils'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/constants'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/errors'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/bip44'),
    ])
    return {
        ...models,
        ...utils,
        ...constants,
        ...errors,
        ...bip44,
        useAccountsStore: { getState: () => ({ accounts: [] }) },
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
}))
