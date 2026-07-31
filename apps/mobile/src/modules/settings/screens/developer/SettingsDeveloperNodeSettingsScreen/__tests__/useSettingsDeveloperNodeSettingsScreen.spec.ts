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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-shared'
import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen'

const switchNetwork = vi.fn()
const mockRequestBottomSheet = vi.fn()

vi.mock('@perawallet/wallet-core-device', () => ({
    useSwitchNetwork: () => ({ switchNetwork }),
}))

// Overrides the global vitest.setup.ts mock (which hard-codes 'mainnet') so
// this suite can flip the active network per-test.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

// The screen hook no longer owns any sheet state itself — selecting `custom`
// just routes to the shared bottom-sheet manager. The sheet's own state
// machine (draft/save/reset validation, cache clearing, etc.) is fully
// covered by useCustomNetworkSheet.spec.ts, so it isn't exercised here.
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useSettingsDeveloperNodeSettingsScreen', () => {
    beforeEach(() => {
        switchNetwork.mockClear()
        mockRequestBottomSheet.mockClear()
    })

    test('lists every network exactly once, regardless of display order', () => {
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

    test('displays MainNet first, followed by TestNet, BetaNet, then Custom', () => {
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

    test('marks the active network as selected and the rest as not', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        // Default mock: useNetwork() -> { network: 'mainnet' }.
        const selected = result.current.networks.filter(row => row.isSelected)
        expect(selected.map(row => row.network)).toEqual([Networks.mainnet])
    })

    test('selecting a real network switches and kicks the sync', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.betanet)
        })

        expect(switchNetwork).toHaveBeenCalledWith(Networks.betanet)
    })

    test('selecting custom requests the sheet from the bottom-sheet manager instead of switching', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.custom)
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledOnce()
        expect(switchNetwork).not.toHaveBeenCalled()
    })

    test('warns on every network except mainnet', () => {
        for (const network of ['testnet', 'betanet', 'custom'] as const) {
            vi.mocked(useNetwork).mockReturnValue({ network } as never)
            const { result } = renderHook(() =>
                useSettingsDeveloperNodeSettingsScreen(),
            )
            expect(result.current.isNonMainnetWarningVisible).toBe(true)
        }

        vi.mocked(useNetwork).mockReturnValue({
            network: Networks.mainnet,
        } as never)
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )
        expect(result.current.isNonMainnetWarningVisible).toBe(false)
    })
})
