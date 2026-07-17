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

    it('switches to testnet: persists the network and nudges the sync service', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.switchTo(Networks.testnet)
        })

        expect(mocks.setNetwork).toHaveBeenCalledWith(Networks.testnet)
        expect(mocks.invalidateQueries).toHaveBeenCalledOnce()
        expect(mocks.restart).toHaveBeenCalledOnce()
        await waitFor(() => expect(result.current.isSwitching).toBe(false))
    })

    it('is a no-op when switching to the current network', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.switchTo(Networks.mainnet)
        })

        expect(mocks.setNetwork).not.toHaveBeenCalled()
        expect(mocks.getSyncService).not.toHaveBeenCalled()
    })

    it('swallows a thrown getSyncService (sync not yet initialized) and still switches', async () => {
        mocks.getSyncService.mockImplementation(() => {
            throw new Error('SyncService not yet initialized')
        })
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.switchTo(Networks.testnet)
        })

        expect(mocks.setNetwork).toHaveBeenCalledWith(Networks.testnet)
        await waitFor(() => expect(result.current.isSwitching).toBe(false))
    })
})
