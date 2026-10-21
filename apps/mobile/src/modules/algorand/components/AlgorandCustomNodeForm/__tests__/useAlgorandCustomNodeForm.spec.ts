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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { CustomNetworkConfig } from '@perawallet/wallet-core-config'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    customNodeAdapters,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
// By source path: the bare subpath is mocked globally, and the barrel's
// module-level `useNetworkStore.subscribe(...)` would reach into other mocks.
import {
    algorandCustomNode,
    getCustomNetworkConfig,
    setCustomNetwork,
} from '@packages/chain-algorand/src/blockchain/store/custom-network'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useAlgorandCustomNodeForm } from '../useAlgorandCustomNodeForm'

const { fetchGenesisFromNode, clearCustomNetworkCache } = vi.hoisted(() => ({
    fetchGenesisFromNode: vi.fn(),
    clearCustomNetworkCache: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({})),
}))

// Real store and shouldClearCustomCache; clearCustomNetworkCache stays mocked
// because it hits the database and query cache.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    clearCustomNetworkCache,
}))

describe('useAlgorandCustomNodeForm', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
        // The real read and save, with only the network fetch stubbed.
        customNodeAdapters.reset()
        customNodeAdapters.register({
            ...algorandCustomNode,
            fetchGenesis: fetchGenesisFromNode,
        })
        fetchGenesisFromNode.mockClear()
        // Reset, not clear: the clear-before-repoint test installs an
        // implementation that snapshots store state, which must not leak.
        clearCustomNetworkCache.mockReset()
    })

    test('seeds the draft from the persisted config at hook init', () => {
        // The regression the open() -> useState move could silently
        // introduce: the component now mounts fresh on each request, so the
        // draft must come from a lazy useState initializer reading whatever
        // is already persisted, not from a since-deleted open() call.
        setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })

        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        expect(result.current.draft).toMatchObject({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
    })

    test('with no persisted config, the draft seeds blank', () => {
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        expect(result.current.draft).toEqual({
            algodUrl: '',
            algodToken: '',
            indexerUrl: '',
            indexerToken: '',
            genesisHash: '',
            genesisId: '',
        })
    })

    test('mounting the hook does not switch the network', () => {
        renderHook(() => useAlgorandCustomNodeForm(LEGACY_CHAIN_ID))

        expect(useNetworkStore.getState().mode).toBe('live')
    })

    test('save persists the config and then commits the switch', async () => {
        // The ordering is the invariant, not just the end state: asserting
        // only that both happened passes even if the switch runs FIRST, which
        // would let the app observe `custom` as active while the store is
        // still empty — the exact state this sheet exists to prevent. So
        // snapshot what the store holds at the moment `custom` becomes active.
        let configAtSwitchTime: CustomNetworkConfig | undefined
        let hasSwitched = false
        const unsubscribe = useNetworkStore.subscribe(state => {
            if (
                !hasSwitched &&
                state.mode === 'developer' &&
                state.selectedNetworkByChain[LEGACY_CHAIN_ID] === 'custom'
            ) {
                hasSwitched = true
                configAtSwitchTime = getCustomNetworkConfig()
            }
        })

        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
            result.current.handleFieldChange('genesisId', 'dockernet-v1')
        })
        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(true)
        expect(getCustomNetworkConfig()).toMatchObject({
            algodUrl: 'http://10.0.0.5:4001',
            genesisHash: 'HASH=',
        })
        unsubscribe()
        expect(useNetworkStore.getState().mode).toBe('developer')
        expect(
            useNetworkStore.getState().selectedNetworkByChain[LEGACY_CHAIN_ID],
        ).toBe('custom')
        expect(configAtSwitchTime).toMatchObject({
            algodUrl: 'http://10.0.0.5:4001',
            genesisHash: 'HASH=',
        })
    })

    test('not calling save persists nothing and does not switch', () => {
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
        })

        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(useNetworkStore.getState().mode).toBe('live')
    })

    test('an invalid URL blocks save entirely, including the switch', async () => {
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'not-a-url')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
        })
        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(false)
        expect(result.current.errors.algodUrl).toBe(true)
        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(useNetworkStore.getState().mode).toBe('live')
    })

    test('a missing genesis hash blocks save', async () => {
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(result.current.errors.genesisHash).toBe(true)
        expect(useNetworkStore.getState().mode).toBe('live')
    })

    test('a missing genesis id blocks save', async () => {
        // fetchGenesisFromNode defaults genesisId to '' when a node omits
        // `genesis-id`, so without this an otherwise "valid" saved config can
        // carry an empty one — and the extension advertises genesisId to every
        // connected dApp.
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(result.current.errors.genesisId).toBe(true)
        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(useNetworkStore.getState().mode).toBe('live')
    })

    test('fetch fills both genesis fields and leaves them editable', async () => {
        fetchGenesisFromNode.mockResolvedValue({
            genesisHash: 'FETCHED=',
            genesisId: 'dockernet-v1',
        })
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
        })
        await act(async () => {
            await result.current.handleFetchGenesis()
        })

        expect(result.current.draft.genesisHash).toBe('FETCHED=')
        expect(result.current.draft.genesisId).toBe('dockernet-v1')

        act(() => {
            result.current.handleFieldChange('genesisHash', 'MANUAL=')
        })
        expect(result.current.draft.genesisHash).toBe('MANUAL=')
    })

    test('a failed fetch surfaces an error but does not block manual entry', async () => {
        fetchGenesisFromNode.mockRejectedValue(new Error('unreachable'))
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
        })
        await act(async () => {
            await result.current.handleFetchGenesis()
        })

        expect(result.current.errors.fetch).toBe(true)

        act(() => {
            result.current.handleFieldChange('genesisHash', 'MANUAL=')
        })
        expect(result.current.errors.genesisHash).toBeFalsy()
    })

    test('reset clears the draft without persisting', () => {
        setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => result.current.handleReset())

        expect(result.current.draft.algodUrl).toBe('')
        // Still persisted — Reset is a draft operation, not a save.
        expect(getCustomNetworkConfig()?.algodUrl).toBe('http://old:4001')
    })

    test('changing the genesis hash on save clears the custom cache', async () => {
        setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('genesisHash', 'NEW=')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(clearCustomNetworkCache).toHaveBeenCalled()
    })

    test('clears the old chain cache BEFORE repointing the clients at the new one', async () => {
        // setCustomNetwork fires the store subscription synchronously, which
        // repoints every ky client at chain B. If the DELETE ran after that, a
        // chain-A query still in flight could resolve against the already-
        // repointed cache-miss path and re-insert its own rows under the single
        // `custom` partition — surviving the sweep that exists to remove them.
        // Ordering is the invariant, so snapshot what the store holds at the
        // moment the clear is called.
        setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
        let configAtClearTime: CustomNetworkConfig | undefined
        clearCustomNetworkCache.mockImplementation(() => {
            configAtClearTime = getCustomNetworkConfig()
        })

        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('genesisHash', 'NEW=')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(configAtClearTime?.genesisHash).toBe('OLD=')
        expect(getCustomNetworkConfig()?.genesisHash).toBe('NEW=')
    })

    test('changing only the host does NOT clear the custom cache', async () => {
        setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'SAME=',
            genesisId: 'g',
        })
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://new:4001')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(clearCustomNetworkCache).not.toHaveBeenCalled()
    })

    describe('when useCustomNode has no adapter to offer', () => {
        beforeEach(() => {
            customNodeAdapters.reset()
        })

        test('fetch reports an error and save stays open', async () => {
            const { result } = renderHook(() =>
                useAlgorandCustomNodeForm(LEGACY_CHAIN_ID),
            )

            act(() => {
                result.current.handleFieldChange(
                    'algodUrl',
                    'http://10.0.0.5:4001',
                )
                result.current.handleFieldChange(
                    'indexerUrl',
                    'http://10.0.0.5:8980',
                )
                result.current.handleFieldChange('genesisHash', 'HASH=')
                result.current.handleFieldChange('genesisId', 'dockernet-v1')
            })
            await act(async () => {
                await result.current.handleFetchGenesis()
            })
            let saved: boolean | undefined
            await act(async () => {
                saved = await result.current.handleSave()
            })

            expect(result.current.errors.fetch).toBe(true)
            expect(fetchGenesisFromNode).not.toHaveBeenCalled()
            expect(saved).toBe(false)
            expect(getCustomNetworkConfig()).toBeUndefined()
            expect(useNetworkStore.getState().mode).toBe('live')
        })
    })

    test('saves nothing for a chain with no custom node adapter', async () => {
        getProvider().chains.register(
            fixtureEthereumDescriptor,
            allCapabilities(false),
        )
        const { result } = renderHook(() =>
            useAlgorandCustomNodeForm('ethereum'),
        )

        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
            result.current.handleFieldChange('genesisId', 'dockernet-v1')
        })
        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(false)
        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(useNetworkStore.getState().selectedNetworkByChain).toEqual({})
    })
})
