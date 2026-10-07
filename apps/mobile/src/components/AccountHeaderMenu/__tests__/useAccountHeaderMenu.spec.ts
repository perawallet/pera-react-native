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

import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'

const { mockCapabilities, mockLock, restart } = vi.hoisted(() => ({
    mockCapabilities: { developerGallery: true },
    mockLock: { fn: null as null | (() => Promise<void>) },
    restart: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({ restart }),
}))

vi.mock('../lockWallet', () => ({
    get lockWallet() {
        return mockLock.fn
    },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

import { useAccountHeaderMenu } from '../useAccountHeaderMenu'

const enableDebugTools = () => {
    ;(usePreferences as Mock).mockReturnValue({
        getPreference: (key: string) =>
            key === UserPreferences.debugToolsEnabled,
        setPreference: vi.fn(),
    })
}

const CHART_LABEL = /portfolio\.(show|hide)_chart/

describe('useAccountHeaderMenu', () => {
    beforeEach(() => {
        ;(usePreferences as Mock).mockReset()
        mockCapabilities.developerGallery = true
        mockLock.fn = null
        restart.mockClear()
        useNetworkStore.getState().resetState()
        useRemoteConfigStore.getState().resetState()
    })

    it('offers search at the Algorand defaults and drops it when assetSearch is off', () => {
        const { result } = renderHook(() => useAccountHeaderMenu())
        expect(result.current.items.map(i => i.label)).toContain('search.title')

        act(() => setCapabilityOverrides({ assetSearch: false }))

        expect(result.current.items.map(i => i.label)).not.toContain(
            'search.title',
        )
    })

    it('leads with the chart toggle by default', () => {
        const { result } = renderHook(() => useAccountHeaderMenu())

        expect(result.current.items[0]?.label).toMatch(CHART_LABEL)
    })

    it('drops the chart toggle where no chart renders and keeps the rest', () => {
        const { result } = renderHook(() =>
            useAccountHeaderMenu({ showChartToggle: false }),
        )

        const labels = result.current.items.map(item => item.label)
        expect(labels.some(label => CHART_LABEL.test(label))).toBe(false)
        expect(labels).toContain('search.title')
    })

    it('adds the gallery shortcut to the developer items where the build includes it', () => {
        enableDebugTools()

        const { result } = renderHook(() => useAccountHeaderMenu())

        expect(result.current.items.map(item => item.label)).toContain(
            'Screen Gallery',
        )
    })

    it('keeps the other developer items but drops the gallery shortcut where the build excludes it', () => {
        mockCapabilities.developerGallery = false
        enableDebugTools()

        const { result } = renderHook(() => useAccountHeaderMenu())

        const labels = result.current.items.map(item => item.label)
        expect(labels).not.toContain('Screen Gallery')
        expect(
            labels.some(label =>
                label.startsWith('settings.developer.node_settings.enable_'),
            ),
        ).toBe(true)
    })

    it('offers no lock where the platform has no manual lock', () => {
        const { result } = renderHook(() => useAccountHeaderMenu())

        expect(result.current.items.map(item => item.label)).not.toContain(
            'vault.security.lock_now',
        )
    })

    it('locks the wallet from the menu where a manual lock exists', () => {
        const lock = vi.fn().mockResolvedValue(undefined)
        mockLock.fn = lock

        const { result } = renderHook(() => useAccountHeaderMenu())
        const item = result.current.items.find(
            i => i.label === 'vault.security.lock_now',
        )
        item?.onPress()

        expect(item).toBeDefined()
        expect(lock).toHaveBeenCalledTimes(1)
    })

    describe('the developer mode item', () => {
        const developerModeItem = (
            items: ReturnType<typeof useAccountHeaderMenu>['items'],
        ) => items.find(item => item.label.endsWith('_developer_mode'))

        it('enables developer mode and restarts sync once', () => {
            enableDebugTools()
            const { result } = renderHook(() => useAccountHeaderMenu())
            const item = developerModeItem(result.current.items)

            expect(item?.label).toBe(
                'settings.developer.node_settings.enable_developer_mode',
            )
            act(() => item?.onPress())

            expect(useNetworkStore.getState().mode).toBe('developer')
            expect(restart).toHaveBeenCalledOnce()
        })

        it('toggles back to live while keeping the stored BetaNet override', () => {
            enableDebugTools()
            useNetworkStore.getState().setMode('developer')
            useNetworkStore.getState().selectNetwork('algorand', 'betanet')
            const { result } = renderHook(() => useAccountHeaderMenu())
            const item = developerModeItem(result.current.items)

            expect(item?.label).toBe(
                'settings.developer.node_settings.disable_developer_mode',
            )
            act(() => item?.onPress())

            const live = useNetworkStore.getState()
            expect(live.mode).toBe('live')
            expect(live.network).toBe('mainnet')
            expect(live.selectedNetworkByChain.algorand).toBe('betanet')

            act(() => developerModeItem(result.current.items)?.onPress())

            expect(useNetworkStore.getState().network).toBe('betanet')
        })

        it('still toggles when the sync service is not initialized', () => {
            restart.mockImplementation(() => {
                throw new Error('SyncService not yet initialized')
            })
            enableDebugTools()
            const { result } = renderHook(() => useAccountHeaderMenu())

            act(() => developerModeItem(result.current.items)?.onPress())

            expect(useNetworkStore.getState().mode).toBe('developer')
            restart.mockReset()
        })
    })
})
