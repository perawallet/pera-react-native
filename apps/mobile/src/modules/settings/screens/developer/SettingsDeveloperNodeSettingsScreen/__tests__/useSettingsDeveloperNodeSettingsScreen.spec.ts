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
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useNodeOverrideStore } from '@perawallet/wallet-core-blockchain'
import { useSettingsDeveloperNodeSettingsScreen } from '../useSettingsDeveloperNodeSettingsScreen'

const switchNetwork = vi.fn()

vi.mock('@perawallet/wallet-core-device', () => ({
    useSwitchNetwork: () => ({ switchNetwork }),
}))

describe('useSettingsDeveloperNodeSettingsScreen', () => {
    beforeEach(() => {
        useNodeOverrideStore.getState().resetState()
        switchNetwork.mockClear()
    })

    test('lists every network exactly once', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        expect(result.current.networks.map(row => row.network)).toEqual(
            Object.values(Networks),
        )
    })

    test('shows baked endpoints and no override by default', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )
        const custom = result.current.networks.find(
            row => row.network === Networks.custom,
        )

        expect(custom?.algodUrl).toBe(
            getNetworkConfig(Networks.custom).algodUrl,
        )
        expect(custom?.isOverridden).toBe(false)
    })

    test('saving an endpoint marks the row overridden', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.custom, {
                algodUrl: 'http://10.0.0.5:4001',
            })
        })

        const custom = result.current.networks.find(
            row => row.network === Networks.custom,
        )
        expect(custom?.algodUrl).toBe('http://10.0.0.5:4001')
        expect(custom?.isOverridden).toBe(true)
    })

    test('rejects a malformed URL rather than persisting it', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.custom, {
                algodUrl: 'not-a-url',
            })
        })

        expect(
            useNodeOverrideStore.getState().overrides[Networks.custom],
        ).toBeUndefined()
    })

    test('sequential saves on different fields merge rather than replace', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.custom, {
                algodUrl: 'http://10.0.0.5:4001',
            })
        })
        act(() => {
            result.current.saveEndpoints(Networks.custom, {
                indexerUrl: 'http://10.0.0.5:8980',
            })
        })

        const custom = result.current.networks.find(
            row => row.network === Networks.custom,
        )
        // A replace (instead of merge) would have wiped the first save's
        // algodUrl back to the baked default when the second save only
        // touched indexerUrl.
        expect(custom?.algodUrl).toBe('http://10.0.0.5:4001')
        expect(custom?.indexerUrl).toBe('http://10.0.0.5:8980')
        expect(custom?.isOverridden).toBe(true)
    })

    test('resetEndpoints restores the baked values', () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        act(() => {
            result.current.saveEndpoints(Networks.custom, {
                algodUrl: 'http://a.example',
            })
        })
        act(() => {
            result.current.resetEndpoints(Networks.custom)
        })

        const custom = result.current.networks.find(
            row => row.network === Networks.custom,
        )
        expect(custom?.isOverridden).toBe(false)
        expect(custom?.algodUrl).toBe(
            getNetworkConfig(Networks.custom).algodUrl,
        )
    })

    test('selecting a network switches and kicks the sync', async () => {
        const { result } = renderHook(() =>
            useSettingsDeveloperNodeSettingsScreen(),
        )

        await act(async () => {
            await result.current.selectNetwork(Networks.betanet)
        })

        expect(switchNetwork).toHaveBeenCalledWith(Networks.betanet)
    })
})
