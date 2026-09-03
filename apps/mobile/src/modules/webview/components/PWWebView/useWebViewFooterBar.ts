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

import {
    type RefObject,
    useCallback,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react'
import type WebView from 'react-native-webview'
import type { WebViewNativeEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { WebViewFavorite } from '@modules/webview/hooks'

type UseWebViewFooterBarParams = {
    webview: RefObject<Nullable<WebView<unknown>>>
    homeUrl?: string
    navigationState?: WebViewNativeEvent
    favorite?: WebViewFavorite
}

type UseWebViewFooterBarResult = {
    isHome: boolean
    canGoBack: boolean
    canGoForward: boolean
    showFavorite: boolean
    isFavorite: boolean
    onBackRequested: () => void
    onForwardRequested: () => void
    onHomeRequested: () => void
    onFavoriteRequested: () => void
}

export const useWebViewFooterBar = ({
    webview,
    homeUrl,
    navigationState,
    favorite,
}: UseWebViewFooterBarParams): UseWebViewFooterBarResult => {
    const [returningHome, setReturningHome] = useState(false)
    const [isFavorite, setIsFavorite] = useState(
        favorite?.initialIsFavorite ?? false,
    )

    const isHome = useMemo(() => {
        return !navigationState || navigationState.url === homeUrl
    }, [navigationState, homeUrl])

    // HACK: there's no way to navigate directly to a URL, so we go all the way
    // back through the history until we reach home.
    useLayoutEffect(() => {
        if (returningHome) {
            if (navigationState?.canGoBack) {
                webview.current?.goBack()
            } else {
                setReturningHome(false)
            }
        }
    }, [returningHome, webview, navigationState])

    const onBackRequested = useCallback(() => {
        if (navigationState?.canGoBack) {
            webview.current?.goBack()
        }
    }, [webview, navigationState])

    const onForwardRequested = useCallback(() => {
        if (navigationState?.canGoForward) {
            webview.current?.goForward()
        }
    }, [webview, navigationState])

    const onHomeRequested = useCallback(() => {
        if (navigationState && !isHome) {
            setReturningHome(true)
        }
    }, [navigationState, isHome])

    const onFavoriteRequested = useCallback(() => {
        if (!favorite) {
            return
        }
        // Optimistic: the host owns persistence, so mirror the flip locally and
        // ask it to toggle. Both sides start from the same seed and toggle in
        // lockstep, so they stay in sync.
        setIsFavorite(current => !current)
        favorite.onToggle()
    }, [favorite])

    return {
        isHome,
        canGoBack: navigationState?.canGoBack ?? false,
        canGoForward: navigationState?.canGoForward ?? false,
        showFavorite: Boolean(favorite),
        isFavorite,
        onBackRequested,
        onForwardRequested,
        onHomeRequested,
        onFavoriteRequested,
    }
}
