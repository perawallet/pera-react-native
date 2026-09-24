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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Linking } from 'react-native'
import { config } from '@perawallet/wallet-core-config'

import { useSettingsDeveloperMenuScreen } from '../useSettingsDeveloperMenuScreen'

const { mockPush, mockPushWebView, mockCapabilities } = vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockPushWebView: vi.fn(),
    mockCapabilities: { developerGallery: true, inAppWebView: true },
}))

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useNavigation: () => ({ push: mockPush }),
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

describe('useSettingsDeveloperMenuScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCapabilities.developerGallery = true
        mockCapabilities.inAppWebView = true
    })

    it('offers the gallery where the build includes it', () => {
        const { result } = renderHook(() => useSettingsDeveloperMenuScreen())

        expect(result.current.isGalleryAvailable).toBe(true)
    })

    it('hides the gallery in builds that exclude it', () => {
        mockCapabilities.developerGallery = false

        const { result } = renderHook(() => useSettingsDeveloperMenuScreen())

        expect(result.current.isGalleryAvailable).toBe(false)
    })

    it('pushes the requested developer screen', () => {
        const { result } = renderHook(() => useSettingsDeveloperMenuScreen())

        result.current.handleNavigate('FeatureFlags')

        expect(mockPush).toHaveBeenCalledWith('FeatureFlags')
    })

    it('opens the testing dapp in the in-app webview when available', () => {
        const { result } = renderHook(() => useSettingsDeveloperMenuScreen())

        result.current.handleOpenTestingDapp()

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.peraDemoDappUrl,
            id: 'Testing Dapp',
            enablePeraConnect: true,
        })
    })

    it('falls back to the system browser without an in-app webview', () => {
        mockCapabilities.inAppWebView = false
        const openURL = vi
            .spyOn(Linking, 'openURL')
            .mockResolvedValue(undefined)

        const { result } = renderHook(() => useSettingsDeveloperMenuScreen())
        result.current.handleOpenTestingDapp()

        expect(openURL).toHaveBeenCalledWith(config.peraDemoDappUrl)
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
