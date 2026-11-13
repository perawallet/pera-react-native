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
import { createChainRegistry } from '@perawallet/wallet-core-chain-contract'
import { evmCapabilityDefaults } from './src/capability-defaults'

// The accounts package reaches the platform provider, whose storage is a
// native module the test runtime cannot load.
const store = new Map<string, string>()
const keyValueStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
        store.delete(key)
    },
}
const registry = createChainRegistry()
// Specs run EVM code without registering its chain; any other id still throws,
// as in production. Listed, not read from the chain table: importing that here
// loads modules before the specs' own config.
const evmChainIds = new Set<string>([
    'ethereum',
    'base',
    'bsc',
    'arbitrum',
    'avalanche',
    'polygon',
    'optimism',
])
const chains = {
    ...registry,
    capabilities: (chainId: Parameters<typeof registry.capabilities>[0]) =>
        !registry.has(chainId) && evmChainIds.has(chainId)
            ? evmCapabilityDefaults
            : registry.capabilities(chainId),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: [] } }),
    getProvider: () => ({ keyValueStorage, chains }),
}))

// Every Pera EVM route is integrity-guarded; the MSW handlers refuse a request
// without a token, so specs see the header the app would send.
vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    buildIntegrityHeadersWhenReady: async () => ({
        'x-app-integrity-token': 'test-integrity-token',
    }),
}))
