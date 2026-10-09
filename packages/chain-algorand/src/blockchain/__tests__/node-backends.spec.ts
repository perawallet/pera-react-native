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

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    getAlgorandChainConfig: () => ({
        algodUrl: 'https://algod.test',
        algodToken: 'algod-token',
        indexerUrl: 'https://indexer.test',
        indexerToken: 'indexer-token',
    }),
}))

import { algorandNodeBackends } from '../node-backends'

describe('algorandNodeBackends', () => {
    it('pairs each node with its own token header', () => {
        expect(
            algorandNodeBackends.backendsFor({
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).toEqual({
            algod: {
                url: 'https://algod.test',
                tokenHeader: 'X-Algo-API-Token',
                token: 'algod-token',
            },
            indexer: {
                url: 'https://indexer.test',
                tokenHeader: 'X-Indexer-API-Token',
                token: 'indexer-token',
            },
        })
    })
})
