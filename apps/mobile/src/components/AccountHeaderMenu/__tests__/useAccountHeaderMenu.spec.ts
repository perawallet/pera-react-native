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
import { renderHook } from '@testing-library/react'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { developerGallery: true },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

import { useAccountHeaderMenu } from '../useAccountHeaderMenu'

const enableDeveloperMenu = () => {
    ;(usePreferences as Mock).mockReturnValue({
        getPreference: (key: string) =>
            key === UserPreferences.developerMenuEnabled,
        setPreference: vi.fn(),
    })
}

const CHART_LABEL = /portfolio\.(show|hide)_chart/

describe('useAccountHeaderMenu', () => {
    beforeEach(() => {
        ;(usePreferences as Mock).mockReset()
        mockCapabilities.developerGallery = true
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
        enableDeveloperMenu()

        const { result } = renderHook(() => useAccountHeaderMenu())

        expect(result.current.items.map(item => item.label)).toContain(
            'Screen Gallery',
        )
    })

    it('keeps the other developer items but drops the gallery shortcut where the build excludes it', () => {
        mockCapabilities.developerGallery = false
        enableDeveloperMenu()

        const { result } = renderHook(() => useAccountHeaderMenu())

        const labels = result.current.items.map(item => item.label)
        expect(labels).not.toContain('Screen Gallery')
        expect(
            labels.some(label =>
                label.startsWith('settings.developer.node_settings.enable_'),
            ),
        ).toBe(true)
    })
})
