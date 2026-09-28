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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Linking } from 'react-native'
import { useWebView, useWebViewStore } from '../useWebViewStore'

const { mockRouteCapabilities } = vi.hoisted(() => ({
    mockRouteCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockRouteCapabilities,
}))

describe('useWebView', () => {
    beforeEach(() => {
        useWebViewStore.getState().clearWebViews()
        mockRouteCapabilities.inAppWebView = true
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    })

    it('pushes onto the webview stack where in-app webviews exist', () => {
        const { result } = renderHook(() => useWebView())

        act(() => {
            result.current.pushWebView({ url: 'https://staking.example' })
        })

        expect(useWebViewStore.getState().openWebViews).toHaveLength(1)
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('opens a browser tab where nothing mounts the webview stack', () => {
        mockRouteCapabilities.inAppWebView = false
        const { result } = renderHook(() => useWebView())

        act(() => {
            result.current.pushWebView({
                url: 'https://staking.example/pool',
                enablePeraConnect: true,
            })
        })

        expect(Linking.openURL).toHaveBeenCalledWith(
            'https://staking.example/pool',
        )
        expect(useWebViewStore.getState().openWebViews).toHaveLength(0)
    })

    it.each([
        'http://staking.example',
        'javascript:alert(1)',
        '//evil.example',
    ])('refuses to open %s in a browser tab', url => {
        mockRouteCapabilities.inAppWebView = false
        const { result } = renderHook(() => useWebView())

        act(() => {
            result.current.pushWebView({ url })
        })

        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(useWebViewStore.getState().openWebViews).toHaveLength(0)
    })

    // A relative URL passed to Linking.openURL on web resolves against the
    // extension's own origin, so only absolute https URLs may reach it.
    it('never hands a relative URL to the browser', () => {
        mockRouteCapabilities.inAppWebView = false
        const { result } = renderHook(() => useWebView())

        act(() => {
            result.current.pushWebView({ url: 'expanded.html?deeplink=x' })
        })

        const opened = vi.mocked(Linking.openURL).mock.calls[0]?.[0] ?? ''
        expect(opened.startsWith('https://')).toBe(true)
    })
})
