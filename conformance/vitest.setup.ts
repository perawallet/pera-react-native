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
