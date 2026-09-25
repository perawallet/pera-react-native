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
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { CustomNetworkConfig } from '../network-store'

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
        test.each(['mainnet', 'testnet', 'betanet'])(
            'a v1 %s selection moves into the algorand entry',
            async network => {
                seedV1(network)

                const { useNetworkStore } = await loadStore()

                const state = useNetworkStore.getState()
                expect(state.selectedNetworkByChain.algorand).toBe(network)
                expect(state.network).toBe(network)
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

        test('a malformed legacy record is ignored', async () => {
            seedV1('custom', '{not json')

            const { useNetworkStore } = await loadStore()

            const state = useNetworkStore.getState()
            expect(state.network).toBe('mainnet')
            expect(state.customNetworksByChain.algorand).toEqual([])
        })

        test('writes back a v2 blob with only the maps and keeps the legacy key', async () => {
            seedV1('custom', legacyEnvelope(CONFIG))

            await loadStore()

            const written = JSON.parse(storage().getItem('network-store')!)
            expect(written.version).toBe(2)
            expect(Object.keys(written.state).sort()).toEqual([
                'customNetworksByChain',
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

        test('drops a malformed custom entry and unknown chain keys', async () => {
            const { mergePersistedNetwork } = await loadStore()

            const merged = mergePersistedNetwork({
                selectedNetworkByChain: { algorand: 'testnet', solana: 'x' },
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
            ['a non-string selection', { selectedNetworkByChain: { algorand: 7 } }],
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
})
