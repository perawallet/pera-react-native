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
    requestBottomSheet: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({
        network: mocks.network,
        isMainnet: mocks.network === Networks.mainnet,
        isTestnet: mocks.network === Networks.testnet,
    }),
    useNetworkStore: {
        getState: () => ({ setNetwork: mocks.setNetwork }),
    },
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => mocks.getSyncService(),
}))

// The screen hook no longer owns any sheet state itself — selecting `custom`
// just routes to the shared bottom-sheet manager. The sheet's own state
// machine (draft/save/reset validation, cache clearing, etc.) is fully
// covered by useCustomNetworkSheet.spec.ts, so it isn't exercised here; this
// suite only needs to verify the web screen hook's OWN routing and
// isSwitching behaviour.
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.requestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen.web'

describe('useSettingsDeveloperNodeSettingsScreen (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.network = Networks.mainnet
        mocks.getSyncService.mockImplementation(() => ({
            invalidateQueries: mocks.invalidateQueries,
            restart: mocks.restart,
        }))
    })

    it('lists every network exactly once, regardless of display order', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        // Guards against a network being added to the union without a
        // matching NETWORK_DISPLAY_ORDER entry — a plain Network[] type
        // can't catch that at compile time.
        expect(result.current.networks.map(row => row.network).sort()).toEqual(
            Object.values(Networks).sort(),
        )
    })

    it('displays MainNet first, followed by TestNet, BetaNet, then Custom', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        expect(result.current.networks.map(row => row.network)).toEqual([
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
            Networks.custom,
        ])
        expect(result.current.networks[0].network).toBe(Networks.mainnet)
    })

    it('marks the active network as selected and the rest as not', () => {
        mocks.network = Networks.testnet

        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        const selected = result.current.networks.filter(row => row.isSelected)
        expect(selected.map(row => row.network)).toEqual([Networks.testnet])
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

    it('selecting custom requests the sheet from the bottom-sheet manager instead of switching', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.custom)
        })

        expect(mocks.requestBottomSheet).toHaveBeenCalledOnce()
        expect(mocks.setNetwork).not.toHaveBeenCalled()
    })

    it('warns on every network except mainnet', () => {
        for (const network of ['testnet', 'betanet', 'custom'] as const) {
            mocks.network = network
            const { result } = renderHook(() =>
                useSettingsDeveloperNodeSettingsScreen(),
            )
            expect(result.current.isNonMainnetWarningVisible).toBe(true)
        }

        mocks.network = Networks.mainnet
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )
        expect(result.current.isNonMainnetWarningVisible).toBe(false)
    })
})
