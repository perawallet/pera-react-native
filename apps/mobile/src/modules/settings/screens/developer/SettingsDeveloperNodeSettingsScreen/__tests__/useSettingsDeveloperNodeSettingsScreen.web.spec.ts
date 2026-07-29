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
    sheetOpen: vi.fn(),
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

// The sheet's own state machine (open/save/cancel/reset validation, cache
// clearing, etc.) is fully covered by useCustomNetworkSheet.spec.ts. This
// suite only needs to verify the web screen hook's OWN routing and
// isSwitching behaviour, so the sheet hook is stubbed rather than exercised
// for real — it would otherwise also need its own device/query-client mocks
// duplicated here for no added coverage.
vi.mock('../useCustomNetworkSheet', () => ({
    useCustomNetworkSheet: () => ({
        isOpen: false,
        draft: {
            algodUrl: '',
            algodToken: '',
            indexerUrl: '',
            indexerToken: '',
            genesisHash: '',
            genesisId: '',
        },
        errors: {},
        isFetching: false,
        open: mocks.sheetOpen,
        close: vi.fn(),
        handleFieldChange: vi.fn(),
        handleFetchGenesis: vi.fn(),
        handleSave: vi.fn(),
        handleReset: vi.fn(),
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

    it('selecting custom opens the sheet instead of switching', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.custom)
        })

        expect(mocks.sheetOpen).toHaveBeenCalledOnce()
        expect(mocks.setNetwork).not.toHaveBeenCalled()
    })
})
