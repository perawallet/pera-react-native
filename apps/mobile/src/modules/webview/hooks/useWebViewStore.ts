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

import { useCallback } from 'react'
import { Linking } from 'react-native'
import { create } from 'zustand'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { routeCapabilities } from '@routes/capabilities'
import { toValidatedBrowserUrl } from './handlers-shared'

/**
 * Favorite capability for a controlled WebView. Present only when the host
 * (e.g. the Discover web app) opened this WebView with favorite support, which
 * is what gates the footer's star button. `onToggle` asks the host to flip the
 * page's favorite state; the host owns persistence.
 */
export type WebViewFavorite = {
    initialIsFavorite: boolean
    onToggle: () => void
}

export type WebViewRequest = {
    id: string
    url: string
    enablePeraConnect?: boolean
    onBackRequested?: () => void
    onCloseRequested?: () => void
    favorite?: WebViewFavorite
}

type WebViewState = {
    openWebViews: WebViewRequest[]
}

type WebViewActions = {
    pushWebView: (view: Omit<WebViewRequest, 'id'> & { id?: string }) => void
    popWebView: () => void
    removeWebView: (id: string) => void
    clearWebViews: () => void
}

type WebViewStore = WebViewState & WebViewActions

const initialState: WebViewState = {
    openWebViews: [],
}

export const useWebViewStore = create<WebViewStore>()(set => ({
    ...initialState,
    pushWebView: view =>
        set(state => ({
            openWebViews: [
                ...state.openWebViews,
                { ...view, id: view.id ?? generateOrderedUniqueId() },
            ],
        })),
    popWebView: () =>
        set(state => ({
            openWebViews: state.openWebViews.slice(0, -1),
        })),
    removeWebView: id =>
        set(state => ({
            openWebViews: state.openWebViews.filter(view => view.id !== id),
        })),
    clearWebViews: () => set({ openWebViews: [] }),
}))

// Explicit return types for decoupled access
type UseWebViewResult = {
    pushWebView: (view: Omit<WebViewRequest, 'id'> & { id?: string }) => void
    removeWebView: (id: string) => void
}

export const useWebView = (): UseWebViewResult => {
    const push = useWebViewStore(state => state.pushWebView)
    const removeWebView = useWebViewStore(state => state.removeWebView)

    const pushWebView = useCallback<UseWebViewResult['pushWebView']>(
        view => {
            if (routeCapabilities.inAppWebView) {
                push(view)
                return
            }
            // Nothing mounts the webview stack when in-app webviews are off,
            // so a push would silently do nothing; open a browser tab instead.
            const url = toValidatedBrowserUrl(view.url)
            if (!url) {
                logger.warn('Blocked browser open for an unsafe URL', {
                    url: view.url,
                })
                return
            }
            void Linking.openURL(url)
        },
        [push],
    )

    return { pushWebView, removeWebView }
}

type UseWebViewStackResult = {
    openWebViews: WebViewRequest[]
    popWebView: () => void
    removeWebView: (id: string) => void
    clearWebViews: () => void
}

export const useWebViewStack = (): UseWebViewStackResult => {
    const openWebViews = useWebViewStore(state => state.openWebViews)
    const popWebView = useWebViewStore(state => state.popWebView)
    const removeWebView = useWebViewStore(state => state.removeWebView)
    const clearWebViews = useWebViewStore(state => state.clearWebViews)

    return { openWebViews, popWebView, removeWebView, clearWebViews }
}
