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

import { describe, test, expect, vi } from 'vitest'
import type { CustomNetworkConfig } from '@perawallet/wallet-core-config'

const registerCustomNetworkSourceMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        registerCustomNetworkSource: registerCustomNetworkSourceMock,
    }
})

const CONFIG: CustomNetworkConfig = {
    algodUrl: 'http://192.168.1.50:4001',
    algodToken: 'a'.repeat(64),
    indexerUrl: 'http://192.168.1.50:8980',
    genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
    genesisId: 'dockernet-v1',
}

const load = async () => {
    vi.resetModules()
    const module = await import('../custom-network')
    const { useNetworkStore } =
        await import('@perawallet/wallet-core-chain-shared')
    useNetworkStore.getState().resetState()
    const source = registerCustomNetworkSourceMock.mock.calls.at(-1)?.[0]
    return { ...module, useNetworkStore, source }
}

describe('Algorand custom network', () => {
    test('saves the node under the custom id and reads it back', async () => {
        const { setCustomNetwork, getCustomNetworkConfig, useNetworkStore } =
            await load()

        setCustomNetwork(CONFIG)

        expect(getCustomNetworkConfig()).toEqual({ ...CONFIG, id: 'custom' })
        expect(
            useNetworkStore.getState().customNetworksByChain.algorand,
        ).toEqual([{ ...CONFIG, id: 'custom' }])
    })

    test('ignores a saved node missing a required field', async () => {
        const { isCustomNetworkConfigured, useNetworkStore } = await load()

        useNetworkStore.getState().setCustomNetwork('algorand', {
            id: 'custom',
            algodUrl: CONFIG.algodUrl,
        })

        expect(isCustomNetworkConfigured()).toBe(false)
    })

    test('clearCustomNetwork returns to unconfigured', async () => {
        const {
            setCustomNetwork,
            clearCustomNetwork,
            isCustomNetworkConfigured,
        } = await load()
        setCustomNetwork(CONFIG)

        clearCustomNetwork()

        expect(isCustomNetworkConfigured()).toBe(false)
    })

    describe('custom network source', () => {
        test('resolves nothing until a custom network is saved', async () => {
            const { source } = await load()

            expect(
                source({ chainId: 'algorand', networkId: 'custom' }),
            ).toBeUndefined()
        })

        test('resolves nothing for any scope other than Algorand custom', async () => {
            const { source, setCustomNetwork } = await load()
            setCustomNetwork(CONFIG)

            expect(
                source({ chainId: 'algorand', networkId: 'mainnet' }),
            ).toBeUndefined()
        })

        test('resolves the saved node, defaulting missing tokens to empty', async () => {
            const { source, setCustomNetwork } = await load()
            setCustomNetwork(CONFIG)

            expect(
                source({ chainId: 'algorand', networkId: 'custom' }),
            ).toEqual({
                algodUrl: CONFIG.algodUrl,
                indexerUrl: CONFIG.indexerUrl,
                algodToken: CONFIG.algodToken,
                indexerToken: '',
                genesisHash: CONFIG.genesisHash,
                genesisId: CONFIG.genesisId,
            })
        })
    })
})
