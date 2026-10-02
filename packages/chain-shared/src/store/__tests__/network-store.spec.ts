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
import type { CustomNetworkConfig } from '@perawallet/wallet-core-config'

const registerStoreMock = vi.hoisted(() => vi.fn())

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
        { id: 'goerli', tier: 'testnet', isDefaultForTier: false },
    ],
} as unknown as ChainDescriptor

const algorandDescriptor = {
    id: 'algorand',
    networks: [
        { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
        { id: 'testnet', tier: 'testnet', isDefaultForTier: true },
        { id: 'betanet', tier: 'testnet', isDefaultForTier: false },
    ],
} as unknown as ChainDescriptor

const PERSISTED_KEYS = [
    'customNetworksByChain',
    'mode',
    'network',
    'selectedNetworkByChain',
]

const registerAlgorand = () =>
    getProvider().chains.register(algorandDescriptor, {
        ...(Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, false]),
        ) as ChainCapabilities),
        customNetworks: true,
    })

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

type Store = Awaited<ReturnType<typeof loadStore>>

const ALGORAND = 'algorand' as ChainId

const savedCustom = ({ useNetworkStore, selectCustomNetwork }: Store) =>
    selectCustomNetwork(useNetworkStore.getState(), ALGORAND, 'custom')

const saveCustom = ({ useNetworkStore }: Store, config: CustomNetworkConfig) =>
    useNetworkStore
        .getState()
        .setCustomNetwork(ALGORAND, { ...config, id: 'custom' })

const clearCustom = ({ useNetworkStore }: Store) =>
    useNetworkStore.getState().clearCustomNetwork(ALGORAND, 'custom')

describe('chain-shared network-store', () => {
    beforeEach(() => {
        registerStoreMock.mockClear()
    })

    describe('v1 migration', () => {
        test.each([
            ['mainnet', 'live', undefined],
            ['testnet', 'developer', undefined],
            ['betanet', 'developer', 'betanet'],
        ])(
            'a v1 %s selection becomes mode %s',
            async (network, mode, algorandOverride) => {
                seedV1(network)

                const { useNetworkStore } = await loadStore()

                const state = useNetworkStore.getState()
                expect(state.mode).toBe(mode)
                expect(state.selectedNetworkByChain.algorand).toBe(
                    algorandOverride,
                )
                expect(state.network).toBe(network)
                expect(state.customNetworksByChain.algorand).toEqual([])
            },
        )

        test('a v1 custom selection with a legacy record keeps both', async () => {
            seedV1('custom', legacyEnvelope(CONFIG))

            const store = await loadStore()

            const state = store.useNetworkStore.getState()
            expect(state.customNetworksByChain.algorand).toEqual([
                { ...CONFIG, id: 'custom' },
            ])
            expect(state.selectedNetworkByChain.algorand).toBe('custom')
            expect(state.network).toBe('custom')
            expect(state.mode).toBe('developer')
            expect(savedCustom(store)).toMatchObject(CONFIG)
        })

        test('a v1 custom selection with no legacy record falls back to the default', async () => {
            seedV1('custom')

            const { useNetworkStore } = await loadStore()

            expect(useNetworkStore.getState().network).toBe('mainnet')
            expect(useNetworkStore.getState().mode).toBe('live')
        })

        test.each(['fnet', 'nope'])(
            'an unknown v1 value (%s) falls back to the default',
            async network => {
                seedV1(network)

                const { useNetworkStore } = await loadStore()

                const state = useNetworkStore.getState()
                expect(state.mode).toBe('live')
                expect(state.selectedNetworkByChain.algorand).toBeUndefined()
                expect(state.network).toBe('mainnet')
            },
        )

        test('a legacy record with no network-store blob is still folded in', async () => {
            storage().setItem('custom-network-store', legacyEnvelope(CONFIG))

            const store = await loadStore()

            expect(savedCustom(store)).toMatchObject(CONFIG)
            expect(store.useNetworkStore.getState().network).toBe('mainnet')
        })

        test('a malformed legacy record is ignored', async () => {
            seedV1('custom', '{not json')

            const { useNetworkStore } = await loadStore()

            const state = useNetworkStore.getState()
            expect(state.network).toBe('mainnet')
            expect(state.customNetworksByChain.algorand).toEqual([])
        })

        test('writes back a v3 blob with only the persisted fields and keeps the legacy key', async () => {
            seedV1('custom', legacyEnvelope(CONFIG))

            await loadStore()

            const written = JSON.parse(storage().getItem('network-store')!)
            expect(written.version).toBe(3)
            expect(Object.keys(written.state).sort()).toEqual(PERSISTED_KEYS)
            expect(storage().getItem('custom-network-store')).not.toBeNull()
        })
    })

    describe('v2 migration', () => {
        const record = { ...CONFIG, id: 'custom' }

        // [globalNetwork, Algorand entry, has record, mode, Algorand override, network]
        test.each([
            ['mainnet', 'mainnet', false, 'live', undefined, 'mainnet'],
            ['testnet', 'testnet', false, 'developer', undefined, 'testnet'],
            ['testnet', 'betanet', false, 'developer', 'betanet', 'betanet'],
            ['custom', 'custom', true, 'developer', 'custom', 'custom'],
            ['custom', 'custom', false, 'live', undefined, 'mainnet'],
            ['betanet', 'mainnet', false, 'live', undefined, 'mainnet'],
            [undefined, 'fnet', false, 'live', undefined, 'mainnet'],
        ])(
            'global %s with Algorand entry %s (record: %s) lands on %s',
            async (
                globalNetwork,
                entry,
                hasRecord,
                mode,
                algorandOverride,
                network,
            ) => {
                storage().setItem(
                    'network-store',
                    JSON.stringify({
                        state: {
                            globalNetwork,
                            selectedNetworkByChain: {
                                algorand: entry,
                                ethereum: 'sepolia',
                            },
                            customNetworksByChain: {
                                algorand: hasRecord ? [record] : [],
                            },
                        },
                        version: 2,
                    }),
                )

                const { useNetworkStore } = await loadStore()

                const state = useNetworkStore.getState()
                expect(state.mode).toBe(mode)
                expect(state.selectedNetworkByChain).toEqual({
                    ethereum: 'sepolia',
                    ...(algorandOverride && { algorand: algorandOverride }),
                })
                expect(state.network).toBe(network)
                expect(state.customNetworksByChain.algorand).toEqual(
                    hasRecord ? [record] : [],
                )
                const written = JSON.parse(storage().getItem('network-store')!)
                expect(written.version).toBe(3)
                expect(Object.keys(written.state).sort()).toEqual(
                    PERSISTED_KEYS,
                )
                expect(written.state.network).toBe(network)
            },
        )

        test('a v2 blob with no Algorand entry falls back to the default and keeps other overrides', async () => {
            storage().setItem(
                'network-store',
                JSON.stringify({
                    state: { selectedNetworkByChain: { ethereum: 'sepolia' } },
                    version: 2,
                }),
            )

            const { useNetworkStore } = await loadStore()

            const state = useNetworkStore.getState()
            expect(state.mode).toBe('live')
            expect(state.selectedNetworkByChain).toEqual({
                ethereum: 'sepolia',
            })
        })
    })

    describe('mergePersistedNetwork', () => {
        const record = { ...CONFIG, id: 'custom' }

        test('a valid v3 blob survives', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                mode: 'developer',
                selectedNetworkByChain: { algorand: 'custom' },
                customNetworksByChain: { algorand: [record] },
            })

            expect(merged.mode).toBe('developer')
            expect(merged.selectedNetworkByChain.algorand).toBe('custom')
            expect(merged.network).toBe('custom')
            expect(merged.customNetworksByChain.algorand).toEqual([record])
        })

        test("keeps every chain's custom records by id and leaves their config to the chain", async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                mode: 'developer',
                selectedNetworkByChain: { algorand: 'betanet' },
                customNetworksByChain: {
                    algorand: [record, { id: 'Bad Id', algodUrl: 1 }, null],
                    solana: [record],
                },
            })

            expect(merged.customNetworksByChain).toEqual({
                algorand: [record],
                solana: [record],
            })
            expect(merged.selectedNetworkByChain).toEqual({
                algorand: 'betanet',
            })
        })

        test("keeps another chain's override and drops one that is not a network id", async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                mode: 'developer',
                selectedNetworkByChain: {
                    algorand: 'betanet',
                    ethereum: 'sepolia',
                    solana: 'Not An Id',
                    cosmos: 7,
                },
            })

            expect(merged.selectedNetworkByChain).toEqual({
                algorand: 'betanet',
                ethereum: 'sepolia',
            })
            expect(merged.network).toBe('betanet')
        })

        test("keeps another chain's override through a rehydrate", async () => {
            const { useNetworkStore } = await loadStore()
            const { merge } = useNetworkStore.persist.getOptions()

            const merged = merge?.(
                {
                    mode: 'live',
                    selectedNetworkByChain: { ethereum: 'sepolia' },
                },
                useNetworkStore.getState(),
            )

            expect(merged?.selectedNetworkByChain).toEqual({
                ethereum: 'sepolia',
            })
        })

        test.each([undefined, 'mainnet', 'Live', 7])(
            'an invalid mode (%s) falls back to the default',
            async mode => {
                const { mergePersistedNetwork } = await loadStore()

                const merged = mergePersistedNetwork({
                    mode,
                    selectedNetworkByChain: { ethereum: 'sepolia' },
                })

                expect(merged.mode).toBe('live')
                expect(merged.network).toBe('mainnet')
                expect(merged.selectedNetworkByChain).toEqual({
                    ethereum: 'sepolia',
                })
            },
        )

        test.each([
            ['mainnet', undefined],
            ['custom', undefined],
            ['fnet', undefined],
        ])(
            'developer with an unusable Algorand override (%s) demotes to the default and keeps other overrides',
            async override => {
                const { mergePersistedNetwork } = await loadStore()

                const merged = mergePersistedNetwork({
                    mode: 'developer',
                    selectedNetworkByChain: {
                        algorand: override,
                        ethereum: 'sepolia',
                    },
                })

                expect(merged.mode).toBe('live')
                expect(merged.network).toBe('mainnet')
                expect(merged.selectedNetworkByChain).toEqual({
                    ethereum: 'sepolia',
                })
            },
        )

        test('live with an unusable Algorand override stays live and drops it', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                mode: 'live',
                selectedNetworkByChain: { algorand: 'custom' },
            })

            expect(merged.mode).toBe('live')
            expect(merged.selectedNetworkByChain).toEqual({})
        })

        test('live keeps a usable Algorand override unread', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                mode: 'live',
                selectedNetworkByChain: { algorand: 'betanet' },
            })

            expect(merged.selectedNetworkByChain.algorand).toBe('betanet')
            expect(merged.network).toBe('mainnet')
        })

        test.each([
            ['null', null],
            ['an empty object', {}],
            [
                'a non-string override',
                { mode: 'developer', selectedNetworkByChain: { algorand: 7 } },
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
                { mode: 'developer', selectedNetworkByChain: {} },
                useNetworkStore.getState(),
            )
            const untouched = merge?.(undefined, useNetworkStore.getState())

            expect(merged?.network).toBe('testnet')
            expect(typeof merged?.selectNetwork).toBe('function')
            expect(untouched?.network).toBe('betanet')
        })
    })

    describe('actions', () => {
        test('setMode keeps overrides and moves the shim: live ignores them, developer restores them', async () => {
            const { useNetworkStore } = await loadStore()
            const store = useNetworkStore.getState()
            store.setMode('developer')
            store.selectNetwork('algorand', 'betanet')
            store.selectNetwork(ETHEREUM, 'sepolia')
            expect(useNetworkStore.getState().network).toBe('betanet')

            useNetworkStore.getState().setMode('live')
            expect(useNetworkStore.getState().network).toBe('mainnet')
            expect(useNetworkStore.getState().selectedNetworkByChain).toEqual({
                algorand: 'betanet',
                ethereum: 'sepolia',
            })

            useNetworkStore.getState().setMode('developer')
            expect(useNetworkStore.getState().network).toBe('betanet')
            expect(useNetworkStore.getState().selectedNetworkByChain).toEqual({
                algorand: 'betanet',
                ethereum: 'sepolia',
            })
        })

        test('selectNetwork to the default test network removes the override', async () => {
            const { useNetworkStore } = await loadStore()
            registerEthereum()
            const store = useNetworkStore.getState()
            store.setMode('developer')
            store.selectNetwork(ETHEREUM, 'goerli')
            expect(
                useNetworkStore.getState().selectedNetworkByChain.ethereum,
            ).toBe('goerli')

            useNetworkStore.getState().selectNetwork(ETHEREUM, 'sepolia')

            expect(
                'ethereum' in useNetworkStore.getState().selectedNetworkByChain,
            ).toBe(false)
        })

        test.each([
            ['mainnet', 'live', undefined, 'mainnet'],
            ['testnet', 'developer', undefined, 'testnet'],
            ['betanet', 'developer', 'betanet', 'betanet'],
            ['custom', 'developer', 'custom', 'custom'],
        ] as const)(
            'setNetwork(%s) sets mode %s and Algorand override %s',
            async (network, mode, algorandOverride, shim) => {
                const { useNetworkStore } = await loadStore()
                useNetworkStore.getState().selectNetwork(ETHEREUM, 'sepolia')

                useNetworkStore.getState().setNetwork(network)

                const state = useNetworkStore.getState()
                expect(state.mode).toBe(mode)
                expect(state.selectedNetworkByChain.algorand).toBe(
                    algorandOverride,
                )
                expect(state.selectedNetworkByChain.ethereum).toBe('sepolia')
                expect(state.network).toBe(shim)
            },
        )

        test('setNetwork to mainnet keeps every override', async () => {
            const { useNetworkStore } = await loadStore()
            useNetworkStore.getState().setNetwork('betanet')

            useNetworkStore.getState().setNetwork('mainnet')

            const state = useNetworkStore.getState()
            expect(state.mode).toBe('live')
            expect(state.selectedNetworkByChain.algorand).toBe('betanet')
        })

        test('setNetwork to testnet clears a stored Algorand override', async () => {
            const { useNetworkStore } = await loadStore()
            useNetworkStore.getState().setNetwork('betanet')

            useNetworkStore.getState().setNetwork('testnet')

            expect(
                useNetworkStore.getState().selectedNetworkByChain.algorand,
            ).toBeUndefined()
        })

        test('resetState restores live mode and drops overrides', async () => {
            const { useNetworkStore } = await loadStore()
            useNetworkStore.getState().setNetwork('betanet')

            useNetworkStore.getState().resetState()

            const state = useNetworkStore.getState()
            expect(state.mode).toBe('live')
            expect(state.selectedNetworkByChain).toEqual({})
        })

        test('resetState restores the defaults', async () => {
            const store = await loadStore()
            saveCustom(store, CONFIG)
            store.useNetworkStore.getState().setNetwork('custom')

            store.useNetworkStore.getState().resetState()

            const state = store.useNetworkStore.getState()
            expect(state.network).toBe('mainnet')
            expect(state.customNetworksByChain).toEqual({})
        })

        test('setCustomNetwork replaces the whole record', async () => {
            const store = await loadStore()

            saveCustom(store, CONFIG)
            saveCustom(store, {
                algodUrl: 'http://10.0.0.9:4001',
                indexerUrl: 'http://10.0.0.9:8980',
                genesisHash: 'other',
                genesisId: 'other-v1',
            })

            expect(savedCustom(store)?.algodToken).toBeUndefined()
            expect(savedCustom(store)?.algodUrl).toBe('http://10.0.0.9:4001')
        })

        test('clearCustomNetwork returns to unconfigured', async () => {
            const store = await loadStore()
            saveCustom(store, CONFIG)

            clearCustom(store)

            expect(savedCustom(store)).toBeUndefined()
        })

        test('clearCustomNetwork while on custom moves the shim to testnet', async () => {
            registerAlgorand()
            const store = await loadStore()
            saveCustom(store, CONFIG)
            store.useNetworkStore.getState().setNetwork('custom')
            expect(store.useNetworkStore.getState().network).toBe('custom')

            clearCustom(store)

            expect(store.useNetworkStore.getState().network).toBe('testnet')
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
        const state = (
            mode: 'live' | 'developer',
            selectedNetworkByChain: Record<string, string>,
            customIds: string[] = [],
        ) => ({
            mode,
            selectedNetworkByChain,
            customNetworksByChain: {
                algorand: customIds.map(id => ({ ...CONFIG, id })),
            },
        })

        // [override, algorand developer result, ethereum developer result]
        const overrides = [
            [undefined, 'testnet', 'sepolia'],
            ['betanet', 'betanet', 'sepolia'],
            ['custom', 'custom', 'sepolia'],
            ['mainnet', 'testnet', 'sepolia'],
            ['unlisted', 'testnet', 'sepolia'],
        ] as const

        test.each(overrides)('live ignores override %s', async override => {
            const { selectChainNetworkId } = await loadStore()
            registerAlgorand()
            registerEthereum()
            const selection = state(
                'live',
                override ? { algorand: override, ethereum: override } : {},
                ['custom'],
            )

            expect(selectChainNetworkId(selection, 'algorand')).toBe('mainnet')
            expect(selectChainNetworkId(selection, ETHEREUM)).toBe('mainnet')
        })

        test.each(overrides)(
            'developer with override %s',
            async (override, algorand, ethereum) => {
                const { selectChainNetworkId } = await loadStore()
                registerAlgorand()
                registerEthereum()
                const selection = state(
                    'developer',
                    override ? { algorand: override, ethereum: override } : {},
                    ['custom'],
                )

                expect(selectChainNetworkId(selection, 'algorand')).toBe(
                    algorand,
                )
                expect(selectChainNetworkId(selection, ETHEREUM)).toBe(ethereum)
            },
        )

        test('developer ignores a custom override with no saved record', async () => {
            const { selectChainNetworkId } = await loadStore()
            registerAlgorand()

            expect(
                selectChainNetworkId(
                    state('developer', { algorand: 'custom' }),
                    'algorand',
                ),
            ).toBe('testnet')
        })

        test('an unregistered chain resolves to the tier name, or its override in developer mode', async () => {
            const { selectChainNetworkId } = await loadStore()

            expect(selectChainNetworkId(state('live', {}), ETHEREUM)).toBe(
                'mainnet',
            )
            expect(selectChainNetworkId(state('developer', {}), ETHEREUM)).toBe(
                'testnet',
            )
            expect(
                selectChainNetworkId(
                    state('developer', { ethereum: 'goerli' }),
                    ETHEREUM,
                ),
            ).toBe('goerli')
        })
    })
})
