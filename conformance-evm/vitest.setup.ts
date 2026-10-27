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

import { afterEach, beforeAll, vi } from 'vitest'
import { createChainRegistry } from '@perawallet/wallet-core-chain-contract'
import { installMulticall3 } from './src/harness/contracts'
import {
    EVMNET_CHAINS,
    assertEvmnetReachable,
    isAutomine,
    txpoolCounts,
    type EvmnetChain,
} from './src/harness/evmnet'
import {
    installedKeyStore,
    installedKeystoreState,
    resetEvmConformanceSession,
} from './src/harness/context'
import { registerEvmnetChains } from './src/harness/registerEvmnetChains'

// The real provider pulls in RN-native modules (react-native-mmkv) that cannot
// load under Node. This swaps platform storage, the chain registry and key
// custody only; every node call reaches Anvil. Hoisted: a persisted store
// built while the imports load reads storage then.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

// The real provider always carries a chain registry; signing reads chain
// capabilities and descriptors through it.
const chains = createChainRegistry()
registerEvmnetChains(chains)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        // Getters: these exist only once the imports above have loaded, and
        // storage-only callers must not touch them before then.
        get chains() {
            return chains
        },
        get key() {
            return { store: installedKeyStore() }
        },
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
    getKeystoreStore: () => installedKeystoreState(),
}))

const eachChain = <T>(
    check: (chain: EvmnetChain) => Promise<T>,
): Promise<T[]> => Promise.all(EVMNET_CHAINS.map(check))

beforeAll(async () => {
    await eachChain(async chain => {
        await assertEvmnetReachable(chain)
        await installMulticall3(chain)
    })
})

// A test that leaves automine off or a transaction pooled would make every
// later file wait on a block, or race on a nonce, far from the cause. The
// session is retired either way, so a test that forgets to create its own
// fails instead of reusing this one's keys and ledger.
afterEach(async () => {
    try {
        const leaks = (
            await eachChain(async chain => {
                const [automine, pool] = await Promise.all([
                    isAutomine(chain),
                    txpoolCounts(chain),
                ])
                const problems = [
                    ...(automine ? [] : ['automine is off']),
                    ...(pool.pending === 0 && pool.queued === 0
                        ? []
                        : [
                              `txpool holds ${pool.pending} pending and ${pool.queued} queued`,
                          ]),
                ]
                return problems.map(problem => `${chain}: ${problem}`)
            })
        ).flat()
        if (leaks.length > 0) {
            throw new Error(
                `a test left evmnet dirty:\n${leaks.join('\n')}\nrestore automine with withAutomineOff and mine or drop what the test pooled`,
            )
        }
    } finally {
        resetEvmConformanceSession()
    }
})
