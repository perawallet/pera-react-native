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
        const fnet = result.current.networks.find(
            row => row.network === Networks.fnet,
        )

        expect(fnet?.algodUrl).toBe(getNetworkConfig(Networks.fnet).algodUrl)
        expect(fnet?.isOverridden).toBe(false)
    })

    test('saving an endpoint marks the row overridden', () => {
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

    test('rejects a malformed URL rather than persisting it', () => {
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

    test('sequential saves on different fields merge rather than replace', () => {
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

    test('resetEndpoints restores the baked values', () => {
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
