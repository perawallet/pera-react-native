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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebViewFooterBar } from '../useWebViewFooterBar'

vi.mock('react-native-webview', () => ({ default: {} }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navState = (overrides: Record<string, unknown>): any => ({
    url: 'https://dapp.example',
    canGoBack: false,
    canGoForward: false,
    ...overrides,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webviewRef = (instance: Record<string, unknown>): any => ({
    current: instance,
})

describe('useWebViewFooterBar', () => {
    describe('navigation', () => {
        it('exposes canGoBack/canGoForward from the navigation state', () => {
            const { result } = renderHook(() =>
                useWebViewFooterBar({
                    webview: webviewRef({}),
                    navigationState: navState({
                        canGoBack: true,
                        canGoForward: false,
                    }),
                }),
            )

            expect(result.current.canGoBack).toBe(true)
            expect(result.current.canGoForward).toBe(false)
        })

        it('goes back only when the history allows it', () => {
            const goBack = vi.fn()

            const { result } = renderHook(() =>
                useWebViewFooterBar({
                    webview: webviewRef({ goBack }),
                    navigationState: navState({ canGoBack: false }),
                }),
            )

            act(() => result.current.onBackRequested())
            expect(goBack).not.toHaveBeenCalled()
        })

        it('reports isHome when the current url matches homeUrl', () => {
            const { result } = renderHook(() =>
                useWebViewFooterBar({
                    webview: webviewRef({}),
                    homeUrl: 'https://dapp.example',
                    navigationState: navState({ url: 'https://dapp.example' }),
                }),
            )

            expect(result.current.isHome).toBe(true)
        })
    })

    describe('favorite', () => {
        it('hides the star and no-ops when no favorite context is provided', () => {
            const { result } = renderHook(() =>
                useWebViewFooterBar({ webview: webviewRef({}) }),
            )

            expect(result.current.showFavorite).toBe(false)
            expect(result.current.isFavorite).toBe(false)
            expect(() =>
                act(() => result.current.onFavoriteRequested()),
            ).not.toThrow()
        })

        it('seeds the fill state from initialIsFavorite', () => {
            const { result } = renderHook(() =>
                useWebViewFooterBar({
                    webview: webviewRef({}),
                    favorite: { initialIsFavorite: true, onToggle: vi.fn() },
                }),
            )

            expect(result.current.showFavorite).toBe(true)
            expect(result.current.isFavorite).toBe(true)
        })

        it('flips the fill state and asks the host to toggle on press', () => {
            const onToggle = vi.fn()

            const { result } = renderHook(() =>
                useWebViewFooterBar({
                    webview: webviewRef({}),
                    favorite: { initialIsFavorite: false, onToggle },
                }),
            )

            act(() => result.current.onFavoriteRequested())

            expect(result.current.isFavorite).toBe(true)
            expect(onToggle).toHaveBeenCalledTimes(1)
        })
    })
})
