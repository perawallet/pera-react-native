/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    fromConfig: vi.fn(),
    registerErrorTransformer: vi.fn(),
    getNetworkConfig: vi.fn(),
    getNetwork: vi.fn(),
    toAlgodError: vi.fn((e: unknown) => e),
}))

vi.mock('@algorandfoundation/algokit-utils', () => ({
    AlgorandClient: { fromConfig: mocks.fromConfig },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { algodApiKey: 'ALGOD_KEY', indexerApiKey: 'INDEXER_KEY' },
    getNetworkConfig: mocks.getNetworkConfig,
}))

vi.mock('../../store', () => ({
    useNetworkStore: { getState: () => ({ network: mocks.getNetwork() }) },
}))

vi.mock('../../errors', () => ({ toAlgodError: mocks.toAlgodError }))

import { getAlgorandClient } from '../algorandClient'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromConfig.mockReturnValue({
        registerErrorTransformer: mocks.registerErrorTransformer,
    })
    mocks.getNetworkConfig.mockImplementation((network: string) => ({
        algodUrl: `https://algod.${network}`,
        indexerUrl: `https://indexer.${network}`,
    }))
    mocks.getNetwork.mockReturnValue('mainnet')
})

describe('getAlgorandClient', () => {
    it('builds the client from the active store network when no override is given', () => {
        getAlgorandClient()

        expect(mocks.getNetworkConfig).toHaveBeenCalledWith('mainnet')
        expect(mocks.fromConfig).toHaveBeenCalledWith({
            algodConfig: {
                server: 'https://algod.mainnet',
                token: 'ALGOD_KEY',
            },
            indexerConfig: {
                server: 'https://indexer.mainnet',
                token: 'INDEXER_KEY',
            },
        })
    })

    it('uses the network override instead of the store network', () => {
        getAlgorandClient('testnet')

        expect(mocks.getNetworkConfig).toHaveBeenCalledWith('testnet')
        expect(mocks.fromConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                algodConfig: expect.objectContaining({
                    server: 'https://algod.testnet',
                }),
            }),
        )
    })

    it('registers an error transformer and returns the built client', () => {
        const client = getAlgorandClient()

        expect(mocks.registerErrorTransformer).toHaveBeenCalledTimes(1)
        expect(client).toBe(mocks.fromConfig.mock.results[0].value)
    })

    it('the registered transformer routes errors through toAlgodError', async () => {
        getAlgorandClient()

        const transformer = mocks.registerErrorTransformer.mock.calls[0][0] as (
            error: unknown,
        ) => Promise<unknown>
        const error = new Error('boom')
        const result = await transformer(error)

        expect(mocks.toAlgodError).toHaveBeenCalledWith(error)
        expect(result).toBe(error)
    })
})
