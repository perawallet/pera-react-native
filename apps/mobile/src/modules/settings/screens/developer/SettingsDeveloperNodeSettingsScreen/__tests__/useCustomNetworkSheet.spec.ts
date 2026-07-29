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
import { Networks } from '@perawallet/wallet-core-shared'
import {
    getCustomNetworkConfig,
    useCustomNetworkStore,
    type CustomNetworkConfig,
} from '@perawallet/wallet-core-blockchain'
import { useCustomNetworkSheet } from '../useCustomNetworkSheet'

const { switchNetwork, fetchGenesisFromNode, clearCustomNetworkCache } =
    vi.hoisted(() => ({
        switchNetwork: vi.fn(),
        fetchGenesisFromNode: vi.fn(),
        clearCustomNetworkCache: vi.fn(),
    }))

const { mockBackHandlerAddEventListener, mockBackHandlerRemove } = vi.hoisted(
    () => ({
        mockBackHandlerAddEventListener: vi.fn(),
        mockBackHandlerRemove: vi.fn(),
    }),
)

vi.mock('@perawallet/wallet-core-device', () => ({
    useSwitchNetwork: () => ({ switchNetwork }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({})),
}))

// Real store + shouldClearCustomCache (imported by concrete module path, not
// the package barrel, for the same reason the global vitest.setup.ts mock
// does: the barrel re-exports utils/algorandClient, whose module-level
// `useCustomNetworkStore.subscribe(...)` side effect would otherwise run for
// this suite and reach into other mocked modules). fetchGenesisFromNode and
// clearCustomNetworkCache stay mocked — they hit the network and the
// database/query-cache respectively.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const store = await vi.importActual<
        typeof import('../../../../../../../../../packages/blockchain/src/store/custom-network-store')
    >(
        '../../../../../../../../../packages/blockchain/src/store/custom-network-store',
    )
    const { shouldClearCustomCache } = await vi.importActual<
        typeof import('../../../../../../../../../packages/blockchain/src/utils/clearCustomNetworkCache')
    >(
        '../../../../../../../../../packages/blockchain/src/utils/clearCustomNetworkCache',
    )

    return {
        useCustomNetworkStore: store.useCustomNetworkStore,
        getCustomNetworkConfig: store.getCustomNetworkConfig,
        isCustomNetworkConfigured: store.isCustomNetworkConfigured,
        shouldClearCustomCache,
        fetchGenesisFromNode,
        clearCustomNetworkCache,
    }
})

// Minimal, fully-replacing react-native mock — mirrors
// useBlockHardwareBackWhileSheetOpen.spec.ts, the existing precedent for
// testing BackHandler wiring in this repo. Safe here because this hook's
// only `react-native` import is BackHandler, and none of its other
// dependencies (the real store's `persist` + getProvider().keyValueStorage,
// notably) touch react-native at module scope.
vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: mockBackHandlerAddEventListener,
    },
}))

describe('useCustomNetworkSheet', () => {
    beforeEach(() => {
        useCustomNetworkStore.getState().resetState()
        // Reset, not just clear: the persist-before-switch test installs an
        // implementation that snapshots store state, which must not leak.
        switchNetwork.mockReset()
        fetchGenesisFromNode.mockClear()
        clearCustomNetworkCache.mockClear()
        mockBackHandlerAddEventListener.mockClear()
        mockBackHandlerRemove.mockClear()
        mockBackHandlerAddEventListener.mockReturnValue({
            remove: mockBackHandlerRemove,
        })
    })

    test('opening does not switch the network', () => {
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())

        expect(result.current.isOpen).toBe(true)
        expect(switchNetwork).not.toHaveBeenCalled()
    })

    test('save persists the config and then commits the switch', async () => {
        // The ordering is the invariant, not just the end state: asserting
        // only that both happened passes even if the switch runs FIRST, which
        // would let the app observe `custom` as active while the store is
        // still empty — the exact state this sheet exists to prevent. So
        // snapshot what the store holds at the moment switchNetwork is called.
        let configAtSwitchTime: CustomNetworkConfig | undefined
        switchNetwork.mockImplementation(() => {
            configAtSwitchTime = getCustomNetworkConfig()
        })

        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
            result.current.handleFieldChange('genesisId', 'dockernet-v1')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(getCustomNetworkConfig()).toMatchObject({
            algodUrl: 'http://10.0.0.5:4001',
            genesisHash: 'HASH=',
        })
        expect(switchNetwork).toHaveBeenCalledWith(Networks.custom)
        expect(configAtSwitchTime).toMatchObject({
            algodUrl: 'http://10.0.0.5:4001',
            genesisHash: 'HASH=',
        })
        expect(result.current.isOpen).toBe(false)
    })

    test('cancel persists nothing and does not switch', () => {
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://10.0.0.5:4001')
        })
        act(() => result.current.close())

        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(switchNetwork).not.toHaveBeenCalled()
    })

    test('an invalid URL blocks save entirely, including the switch', async () => {
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => {
            result.current.handleFieldChange('algodUrl', 'not-a-url')
            result.current.handleFieldChange(
                'indexerUrl',
                'http://10.0.0.5:8980',
            )
            result.current.handleFieldChange('genesisHash', 'HASH=')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(result.current.errors.algodUrl).toBe(true)
        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(switchNetwork).not.toHaveBeenCalled()
    })

    test('a missing genesis hash blocks save', async () => {
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
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
        expect(switchNetwork).not.toHaveBeenCalled()
    })

    test('fetch fills both genesis fields and leaves them editable', async () => {
        fetchGenesisFromNode.mockResolvedValue({
            genesisHash: 'FETCHED=',
            genesisId: 'dockernet-v1',
        })
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
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
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
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
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => result.current.handleReset())

        expect(result.current.draft.algodUrl).toBe('')
        // Still persisted — Reset is a draft operation, not a save.
        expect(getCustomNetworkConfig()?.algodUrl).toBe('http://old:4001')
    })

    test('changing the genesis hash on save clears the custom cache', async () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'OLD=',
            genesisId: 'g',
        })
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => {
            result.current.handleFieldChange('genesisHash', 'NEW=')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(clearCustomNetworkCache).toHaveBeenCalled()
    })

    test('changing only the host does NOT clear the custom cache', async () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://old:4001',
            indexerUrl: 'http://old:8980',
            genesisHash: 'SAME=',
            genesisId: 'g',
        })
        const { result } = renderHook(() => useCustomNetworkSheet())

        act(() => result.current.open())
        act(() => {
            result.current.handleFieldChange('algodUrl', 'http://new:4001')
        })
        await act(async () => {
            await result.current.handleSave()
        })

        expect(clearCustomNetworkCache).not.toHaveBeenCalled()
    })

    describe('Android hardware back', () => {
        test('is not intercepted while the sheet is closed', () => {
            renderHook(() => useCustomNetworkSheet())

            expect(mockBackHandlerAddEventListener).not.toHaveBeenCalled()
        })

        test('closes the sheet without persisting, like Cancel', () => {
            const { result } = renderHook(() => useCustomNetworkSheet())

            act(() => result.current.open())
            act(() => {
                result.current.handleFieldChange(
                    'algodUrl',
                    'http://10.0.0.5:4001',
                )
            })

            expect(mockBackHandlerAddEventListener).toHaveBeenCalledWith(
                'hardwareBackPress',
                expect.any(Function),
            )
            const handler = mockBackHandlerAddEventListener.mock
                .calls[0]?.[1] as () => boolean

            let handled: boolean | undefined
            act(() => {
                handled = handler()
            })

            expect(handled).toBe(true)
            expect(result.current.isOpen).toBe(false)
            expect(getCustomNetworkConfig()).toBeUndefined()
            expect(switchNetwork).not.toHaveBeenCalled()
        })

        test('unregisters the handler once the sheet closes', () => {
            const { result } = renderHook(() => useCustomNetworkSheet())

            act(() => result.current.open())
            act(() => result.current.close())

            expect(mockBackHandlerRemove).toHaveBeenCalled()
        })
    })
})
