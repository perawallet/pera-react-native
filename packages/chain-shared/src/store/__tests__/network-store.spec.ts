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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { CustomNetworkConfig } from '../network-store'

const registerStoreMock = vi.hoisted(() => vi.fn())
const registerCustomNetworkSourceMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: registerStoreMock }
})

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: { ...actual.config, defaultNetwork: 'mainnet' as const },
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

const storage = () => getProvider().keyValueStorage

const seedV1 = (network: unknown, legacyCustom?: string) => {
    storage().setItem(
        'network-store',
        JSON.stringify({ state: { network }, version: 1 }),
    )
    if (legacyCustom !== undefined) {
        storage().setItem('custom-network-store', legacyCustom)
    }
}

const ETHEREUM = 'ethereum' as ChainId

const ethereumDescriptor = {
    id: ETHEREUM,
    networks: [
        { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
        { id: 'sepolia', tier: 'testnet', isDefaultForTier: true },
    ],
} as unknown as ChainDescriptor

const registerEthereum = (customNetworks = false) =>
    getProvider().chains.register(ethereumDescriptor, {
        ...(Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, false]),
        ) as ChainCapabilities),
        customNetworks,
    })

const legacyEnvelope = (customNetwork: unknown) =>
    JSON.stringify({ state: { customNetwork }, version: 1 })

// Importing the module creates the store, which hydrates synchronously from
// whatever storage holds at that moment.
const loadStore = async () => {
    vi.resetModules()
    return import('../network-store')
}

describe('chain-shared network-store', () => {
    beforeEach(() => {
        registerStoreMock.mockClear()
    })

    describe('v1 migration', () => {
        test.each([
            ['mainnet', 'mainnet'],
            ['testnet', 'testnet'],
            ['betanet', 'testnet'],
        ])(
            'a v1 %s selection moves into the algorand entry',
            async (network, globalNetwork) => {
                seedV1(network)

                const { useNetworkStore } = await loadStore()

                const state = useNetworkStore.getState()
                expect(state.selectedNetworkByChain.algorand).toBe(network)
                expect(state.network).toBe(network)
                expect(state.globalNetwork).toBe(globalNetwork)
                expect(state.customNetworksByChain.algorand).toEqual([])
            },
        )

        test('a v1 custom selection with a legacy record keeps both', async () => {
            seedV1('custom', legacyEnvelope(CONFIG))

            const { useNetworkStore, getCustomNetworkConfig } =
                await loadStore()

            const state = useNetworkStore.getState()
            expect(state.customNetworksByChain.algorand).toEqual([
                { ...CONFIG, id: 'custom' },
            ])
            expect(state.selectedNetworkByChain.algorand).toBe('custom')
            expect(state.network).toBe('custom')
            expect(state.globalNetwork).toBe('custom')
            expect(getCustomNetworkConfig()).toMatchObject(CONFIG)
        })

        test('a v1 custom selection with no legacy record falls back to the default', async () => {
            seedV1('custom')

            const { useNetworkStore } = await loadStore()

            expect(useNetworkStore.getState().network).toBe('mainnet')
        })

        test.each(['fnet', 'nope'])(
            'an unknown v1 value (%s) falls back to the default',
            async network => {
                seedV1(network)

                const { useNetworkStore } = await loadStore()

                expect(
                    useNetworkStore.getState().selectedNetworkByChain.algorand,
                ).toBe('mainnet')
            },
        )

        test('a legacy record with no network-store blob is still folded in', async () => {
            storage().setItem('custom-network-store', legacyEnvelope(CONFIG))

            const { useNetworkStore, isCustomNetworkConfigured } =
                await loadStore()

            expect(isCustomNetworkConfigured()).toBe(true)
            expect(useNetworkStore.getState().network).toBe('mainnet')
        })

        test('a malformed legacy record is ignored', async () => {
            seedV1('custom', '{not json')

            const { useNetworkStore } = await loadStore()

            const state = useNetworkStore.getState()
            expect(state.network).toBe('mainnet')
            expect(state.customNetworksByChain.algorand).toEqual([])
        })

        test('writes back a v2 blob with only the persisted fields and keeps the legacy key', async () => {
            seedV1('custom', legacyEnvelope(CONFIG))

            await loadStore()

            const written = JSON.parse(storage().getItem('network-store')!)
            expect(written.version).toBe(2)
            expect(Object.keys(written.state).sort()).toEqual([
                'customNetworksByChain',
                'globalNetwork',
                'selectedNetworkByChain',
            ])
            expect(storage().getItem('custom-network-store')).not.toBeNull()
        })
    })

    describe('mergePersistedNetwork', () => {
        const record = { ...CONFIG, id: 'custom' }

        test('a valid v2 blob survives', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: { algorand: 'custom' },
                customNetworksByChain: { algorand: [record] },
            })

            expect(merged.selectedNetworkByChain.algorand).toBe('custom')
            expect(merged.network).toBe('custom')
            expect(merged.customNetworksByChain.algorand).toEqual([record])
        })

        test('drops a malformed custom entry and unknown chain custom records', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: { algorand: 'testnet' },
                customNetworksByChain: {
                    algorand: [record, { id: 'Bad Id', algodUrl: 1 }, null],
                    solana: [record],
                },
            })

            expect(merged.customNetworksByChain).toEqual({ algorand: [record] })
            expect(merged.selectedNetworkByChain).toEqual({
                algorand: 'testnet',
            })
        })

        test("keeps another chain's selection and drops one that is not a network id", async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: {
                    algorand: 'testnet',
                    ethereum: 'sepolia',
                    solana: 'Not An Id',
                    cosmos: 7,
                },
            })

            expect(merged.selectedNetworkByChain).toEqual({
                algorand: 'testnet',
                ethereum: 'sepolia',
            })
            expect(merged.network).toBe('testnet')
        })

        test("keeps another chain's selection through a rehydrate", async () => {
            const { useNetworkStore } = await loadStore()
            const { merge } = useNetworkStore.persist.getOptions()

            const merged = merge?.(
                {
                    selectedNetworkByChain: {
                        algorand: 'mainnet',
                        ethereum: 'sepolia',
                    },
                },
                useNetworkStore.getState(),
            )

            expect(merged?.selectedNetworkByChain).toEqual({
                algorand: 'mainnet',
                ethereum: 'sepolia',
            })
        })

        test('derives a missing global selection from the Algorand entry', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: { algorand: 'betanet' },
            })

            expect(merged.globalNetwork).toBe('testnet')
            expect(merged.selectedNetworkByChain.algorand).toBe('betanet')
        })

        test('keeps a valid persisted global selection', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                globalNetwork: 'testnet',
                selectedNetworkByChain: { algorand: 'mainnet' },
            })

            expect(merged.globalNetwork).toBe('testnet')
        })

        test('re-derives an invalid persisted global selection', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                globalNetwork: 'betanet',
                selectedNetworkByChain: { algorand: 'mainnet' },
            })

            expect(merged.globalNetwork).toBe('mainnet')
        })

        test('keeps a Custom global selection while Algorand has a saved custom record', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                globalNetwork: 'custom',
                selectedNetworkByChain: { algorand: 'custom' },
                customNetworksByChain: {
                    algorand: [{ ...CONFIG, id: 'custom' }],
                },
            })

            expect(merged.globalNetwork).toBe('custom')
        })

        test('a demoted custom selection takes the default network as the global selection', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                globalNetwork: 'custom',
                selectedNetworkByChain: { algorand: 'custom' },
            })

            expect(merged.globalNetwork).toBe('mainnet')
        })

        test('demotes a custom selection with no record', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: { algorand: 'custom' },
            })

            expect(merged.network).toBe('mainnet')
            expect(merged.customNetworksByChain).toEqual({ algorand: [] })
        })

        test.each([
            ['null', null],
            ['an empty object', {}],
            [
                'a non-string selection',
                { selectedNetworkByChain: { algorand: 7 } },
            ],
        ])('%s falls back to the default', async (_label, persisted) => {
            const { mergePersistedNetwork } = await loadStore()

            expect(mergePersistedNetwork(persisted).network).toBe('mainnet')
        })

        test('rehydration keeps the actions and leaves state alone on an empty read', async () => {
            const { useNetworkStore } = await loadStore()
            const { merge } = useNetworkStore.persist.getOptions()
            useNetworkStore.getState().setNetwork('betanet')

            const merged = merge?.(
                { selectedNetworkByChain: { algorand: 'testnet' } },
                useNetworkStore.getState(),
            )
            const untouched = merge?.(undefined, useNetworkStore.getState())

            expect(merged?.network).toBe('testnet')
            expect(typeof merged?.selectNetwork).toBe('function')
            expect(untouched?.network).toBe('betanet')
        })
    })

    describe('actions', () => {
        test('selectNetwork and setNetwork both move the map and the shim', async () => {
            const { useNetworkStore } = await loadStore()

            useNetworkStore.getState().selectNetwork('algorand', 'testnet')
            expect(useNetworkStore.getState().network).toBe('testnet')

            useNetworkStore.getState().setNetwork('betanet')
            expect(
                useNetworkStore.getState().selectedNetworkByChain.algorand,
            ).toBe('betanet')
            expect(useNetworkStore.getState().network).toBe('betanet')
        })

        test('setNetwork pins Algorand and sets the global selection from it', async () => {
            const { useNetworkStore } = await loadStore()

            useNetworkStore.getState().setNetwork('betanet')

            const state = useNetworkStore.getState()
            expect(state.globalNetwork).toBe('testnet')
            expect(state.selectedNetworkByChain).toEqual({
                algorand: 'betanet',
            })
        })

        test('setGlobalNetwork moves Algorand and clears other chain overrides', async () => {
            const { useNetworkStore } = await loadStore()
            useNetworkStore.getState().selectNetwork(ETHEREUM, 'mainnet')

            useNetworkStore.getState().setGlobalNetwork('testnet')

            const state = useNetworkStore.getState()
            expect(state.globalNetwork).toBe('testnet')
            expect(state.network).toBe('testnet')
            expect(state.selectedNetworkByChain).toEqual({
                algorand: 'testnet',
            })
        })

        test('resetState restores the global selection', async () => {
            const { useNetworkStore } = await loadStore()
            useNetworkStore.getState().setGlobalNetwork('testnet')

            useNetworkStore.getState().resetState()

            expect(useNetworkStore.getState().globalNetwork).toBe('mainnet')
        })

        test('resetState restores the defaults', async () => {
            const { useNetworkStore, setCustomNetwork } = await loadStore()
            setCustomNetwork(CONFIG)
            useNetworkStore.getState().setNetwork('custom')

            useNetworkStore.getState().resetState()

            const state = useNetworkStore.getState()
            expect(state.network).toBe('mainnet')
            expect(state.customNetworksByChain).toEqual({ algorand: [] })
        })

        test('setCustomNetwork replaces the whole record', async () => {
            const { setCustomNetwork, getCustomNetworkConfig } =
                await loadStore()

            setCustomNetwork(CONFIG)
            setCustomNetwork({
                algodUrl: 'http://10.0.0.9:4001',
                indexerUrl: 'http://10.0.0.9:8980',
                genesisHash: 'other',
                genesisId: 'other-v1',
            })

            expect(getCustomNetworkConfig()?.algodToken).toBeUndefined()
            expect(getCustomNetworkConfig()?.algodUrl).toBe(
                'http://10.0.0.9:4001',
            )
        })

        test('clearCustomNetwork returns to unconfigured', async () => {
            const {
                setCustomNetwork,
                clearCustomNetwork,
                isCustomNetworkConfigured,
            } = await loadStore()
            setCustomNetwork(CONFIG)

            clearCustomNetwork()

            expect(isCustomNetworkConfigured()).toBe(false)
        })

        test('the registered clearStorage removes both keys', async () => {
            seedV1('testnet', legacyEnvelope(CONFIG))
            await loadStore()
            const registration = registerStoreMock.mock.calls.at(-1)?.[0]

            registration.clearStorage()

            expect(registration.name).toBe('network-store')
            expect(storage().getItem('network-store')).toBeNull()
            expect(storage().getItem('custom-network-store')).toBeNull()
        })
    })

    describe('selectChainNetworkId', () => {
        test('a registered chain with no entry follows the global selection', async () => {
            const { useNetworkStore, selectChainNetworkId } = await loadStore()
            registerEthereum()

            useNetworkStore.getState().setGlobalNetwork('testnet')
            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('sepolia')

            useNetworkStore.getState().setGlobalNetwork('mainnet')
            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('mainnet')
        })

        test('Custom resolves a chain without custom networks to its testnet', async () => {
            const { useNetworkStore, selectChainNetworkId } = await loadStore()
            registerEthereum(false)

            useNetworkStore.getState().setNetwork('custom')

            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('sepolia')
        })

        test('a per-chain override wins until the next global pick', async () => {
            const { useNetworkStore, selectChainNetworkId } = await loadStore()
            registerEthereum()
            useNetworkStore.getState().setGlobalNetwork('testnet')

            useNetworkStore.getState().selectNetwork(ETHEREUM, 'mainnet')
            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('mainnet')

            useNetworkStore.getState().setGlobalNetwork('testnet')
            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('sepolia')
        })

        test('an override naming a network the chain does not list follows the global selection', async () => {
            const { useNetworkStore, selectChainNetworkId } = await loadStore()
            registerEthereum()
            useNetworkStore.getState().setGlobalNetwork('testnet')

            useNetworkStore.getState().selectNetwork(ETHEREUM, 'goerli')

            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('sepolia')
        })

        test('an unregistered chain falls back to the global name', async () => {
            const { useNetworkStore, selectChainNetworkId } = await loadStore()

            useNetworkStore.getState().setGlobalNetwork('testnet')

            expect(
                selectChainNetworkId(useNetworkStore.getState(), ETHEREUM),
            ).toBe('testnet')
        })
    })

    describe('custom network source', () => {
        const loadSource = async () => {
            const store = await loadStore()
            const source =
                registerCustomNetworkSourceMock.mock.calls.at(-1)?.[0]
            return { ...store, source }
        }

        test('resolves nothing until a custom network is saved', async () => {
            const { source } = await loadSource()

            expect(
                source({ chainId: 'algorand', networkId: 'custom' }),
            ).toBeUndefined()
        })

        test('resolves nothing for any scope other than Algorand custom', async () => {
            const { source, setCustomNetwork } = await loadSource()
            setCustomNetwork(CONFIG)

            expect(
                source({ chainId: 'algorand', networkId: 'mainnet' }),
            ).toBeUndefined()
        })

        test('resolves the saved node, defaulting missing tokens to empty', async () => {
            const { source, setCustomNetwork } = await loadSource()
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
