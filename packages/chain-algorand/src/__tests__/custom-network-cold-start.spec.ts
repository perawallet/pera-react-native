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

import { describe, expect, test, vi } from 'vitest'
import {
    CUSTOM_NETWORK_ID,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'

const CONFIG = {
    algodUrl: 'http://192.168.1.50:4001',
    algodToken: 'a'.repeat(64),
    indexerUrl: 'http://192.168.1.50:8980',
    genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
    genesisId: 'dockernet-v1',
}

// Only the register path wires the custom-node reader, so this loads a fresh
// module graph whose sole entry is `../register`.
const coldStartCustomChainConfig = async () => {
    vi.resetModules()
    await import('../register')
    const { getChainConfig } = await import('@perawallet/wallet-core-config')
    const { scopeForLegacyNetwork } =
        await import('@perawallet/wallet-core-chain-contract')
    return getChainConfig(scopeForLegacyNetwork('custom'))
}

describe('custom node cold start', () => {
    test('resolves a saved custom node after a cold start', async () => {
        useNetworkStore.getState().setCustomNetwork(LEGACY_CHAIN_ID, {
            ...CONFIG,
            id: CUSTOM_NETWORK_ID,
        })

        const config = await coldStartCustomChainConfig()

        expect(config).toMatchObject({
            algodUrl: CONFIG.algodUrl,
            algodToken: CONFIG.algodToken,
            indexerUrl: CONFIG.indexerUrl,
            indexerToken: '',
            genesisHash: CONFIG.genesisHash,
            genesisId: CONFIG.genesisId,
        })
    }, 30_000)

    test('resolves nothing extra when no custom node was saved', async () => {
        const config = await coldStartCustomChainConfig()

        expect(config.algodUrl).toBe('')
    }, 30_000)
})
