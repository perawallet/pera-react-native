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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

const mockOpenURL = vi.fn()
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    }
})

// Mutable so each test picks the native-shaped (true) or web-shaped (false)
// capability map without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))
vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

import { useOpenCardSupport } from '../useOpenCardSupport'

describe('useOpenCardSupport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
    })

    it('opens support in the in-app WebView when available', () => {
        const { result } = renderHook(() => useOpenCardSupport())

        act(() => {
            result.current()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: expect.any(String),
            id: 'card-support',
        })
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('falls back to a browser tab when the in-app WebView is unavailable (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() => useOpenCardSupport())

        act(() => {
            result.current()
        })

        expect(mockOpenURL).toHaveBeenCalledTimes(1)
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
