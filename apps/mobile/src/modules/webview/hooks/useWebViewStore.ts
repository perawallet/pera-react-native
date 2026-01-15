/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create } from 'zustand'
import { v7 as uuidv7 } from 'uuid'

export type WebViewRequest = {
    id: string
    url: string
    enablePeraConnect?: boolean
    onBackRequested?: () => void
    onCloseRequested?: () => void
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
                { ...view, id: view.id ?? uuidv7() },
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
}

export const useWebView = (): UseWebViewResult => {
    const pushWebView = useWebViewStore(state => state.pushWebView)
    return { pushWebView }
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
