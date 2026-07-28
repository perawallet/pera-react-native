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

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { Networks, type Network } from '@perawallet/wallet-core-shared'

const mocks = vi.hoisted(() => ({
    network: 'mainnet' as Network,
    setNetwork: vi.fn(),
    invalidateQueries: vi.fn(),
    restart: vi.fn(),
    getSyncService: vi.fn(() => ({
        invalidateQueries: mocks.invalidateQueries,
        restart: mocks.restart,
    })),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    // Real store (not hand-mocked): setOverride/clearOverride/resetState need
    // genuine zustand reactivity so this hook's `networks` memo re-renders on
    // change. Imported by its own module path (not the package barrel) to
    // avoid evaluating utils/algorandClient's module-level
    // `useNodeOverrideStore.subscribe(...)` side effect.
    const { useNodeOverrideStore, getNodeEndpointOverride } =
        await vi.importActual<
            typeof import('../../../../../../../../../packages/blockchain/src/store/node-override-store')
        >(
            '../../../../../../../../../packages/blockchain/src/store/node-override-store',
        )

    return {
        useNetwork: () => ({
            network: mocks.network,
            isMainnet: mocks.network === Networks.mainnet,
            isTestnet: mocks.network === Networks.testnet,
        }),
        useNetworkStore: {
            getState: () => ({ setNetwork: mocks.setNetwork }),
        },
        useNodeOverrideStore,
        getNodeEndpointOverride,
    }
})

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => mocks.getSyncService(),
}))

import { useNodeOverrideStore } from '@perawallet/wallet-core-blockchain'
import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen.web'

describe('useSettingsDeveloperNodeSettingsScreen (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.network = Networks.mainnet
        mocks.getSyncService.mockImplementation(() => ({
            invalidateQueries: mocks.invalidateQueries,
            restart: mocks.restart,
        }))
        useNodeOverrideStore.getState().resetState()
    })

    it('lists every network exactly once', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        expect(result.current.networks.map(row => row.network)).toEqual(
            Object.values(Networks),
        )
    })

    it('marks the active network as selected and the rest as not', () => {
        mocks.network = Networks.testnet

        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        const selected = result.current.networks.filter(row => row.isSelected)
        expect(selected.map(row => row.network)).toEqual([Networks.testnet])
    })

    it('shows baked endpoints and no override by default', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )
        const fnet = result.current.networks.find(
            row => row.network === Networks.fnet,
        )

        expect(fnet?.algodUrl).toBe(getNetworkConfig(Networks.fnet).algodUrl)
        expect(fnet?.isOverridden).toBe(false)
    })

    it('saving an endpoint marks the row overridden', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.localnet, {
                algodUrl: 'http://10.0.0.5:4001',
            })
        })

        const localnet = result.current.networks.find(
            row => row.network === Networks.localnet,
        )
        expect(localnet?.algodUrl).toBe('http://10.0.0.5:4001')
        expect(localnet?.isOverridden).toBe(true)
    })

    it('rejects a malformed URL rather than persisting it', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.fnet, {
                algodUrl: 'not-a-url',
            })
        })

        expect(
            useNodeOverrideStore.getState().overrides[Networks.fnet],
        ).toBeUndefined()
    })

    it('sequential saves on different fields merge rather than replace', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.fnet, {
                algodUrl: 'http://10.0.0.5:4001',
            })
        })
        act(() => {
            result.current.saveEndpoints(Networks.fnet, {
                indexerUrl: 'http://10.0.0.5:8980',
            })
        })

        const fnet = result.current.networks.find(
            row => row.network === Networks.fnet,
        )
        // A replace (instead of merge) would have wiped the first save's
        // algodUrl back to the baked default when the second save only
        // touched indexerUrl.
        expect(fnet?.algodUrl).toBe('http://10.0.0.5:4001')
        expect(fnet?.indexerUrl).toBe('http://10.0.0.5:8980')
        expect(fnet?.isOverridden).toBe(true)
    })

    it('resetEndpoints restores the baked values', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.fnet, {
                algodUrl: 'http://a.example',
            })
        })
        act(() => {
            result.current.resetEndpoints(Networks.fnet)
        })

        const fnet = result.current.networks.find(
            row => row.network === Networks.fnet,
        )
        expect(fnet?.isOverridden).toBe(false)
        expect(fnet?.algodUrl).toBe(getNetworkConfig(Networks.fnet).algodUrl)
    })

    it('selects a different network: persists it, flips isSwitching, and nudges the sync service', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.testnet)
        })

        expect(mocks.setNetwork).toHaveBeenCalledWith(Networks.testnet)
        expect(mocks.invalidateQueries).toHaveBeenCalledOnce()
        expect(mocks.restart).toHaveBeenCalledOnce()
        await waitFor(() => expect(result.current.isSwitching).toBe(false))
    })

    it('is a no-op when selecting the current network', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.mainnet)
        })

        expect(mocks.setNetwork).not.toHaveBeenCalled()
        expect(mocks.getSyncService).not.toHaveBeenCalled()
    })

    it('swallows a thrown getSyncService (sync not yet initialized) and still selects', async () => {
        mocks.getSyncService.mockImplementation(() => {
            throw new Error('SyncService not yet initialized')
        })
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.testnet)
        })

        expect(mocks.setNetwork).toHaveBeenCalledWith(Networks.testnet)
        await waitFor(() => expect(result.current.isSwitching).toBe(false))
    })
})
