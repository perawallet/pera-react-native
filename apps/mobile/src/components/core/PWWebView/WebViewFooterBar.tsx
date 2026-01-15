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

import {
    RefObject,
    useCallback,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWIcon } from '@components/core/PWIcon'
import WebView from 'react-native-webview'
import { WebViewNativeEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent'

type WebViewFooterBarProps = {
    webview: RefObject<WebView<unknown> | null>
    homeUrl?: string
    navigationState?: WebViewNativeEvent
}

export const WebViewFooterBar = ({
    webview,
    homeUrl,
    navigationState,
}: WebViewFooterBarProps) => {
    const styles = useStyles()
    const [returningHome, setReturningHome] = useState(false)

    const isHome = useMemo(() => {
        return !navigationState || navigationState.url === homeUrl
    }, [navigationState, homeUrl])

    //HACK: this is a little messy - there's no way seemingly to navigate directly to a URL, so we just
    //go back all the way through the history
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
    }, [webview, navigationState, isHome])

    const onFavoriteRequested = useCallback(() => {
        // TODO: Implement favorite
    }, [webview])

    return (
        <PWView style={styles.footerBar}>
            <PWIcon
                name='chevron-left'
                onPress={onBackRequested}
                variant='primary'
                disabled={!navigationState?.canGoBack}
            />
            <PWIcon
                name='chevron-right'
                onPress={onForwardRequested}
                variant='primary'
                disabled={!navigationState?.canGoForward}
            />
            <PWIcon
                name='house'
                onPress={onHomeRequested}
                variant='primary'
                disabled={isHome}
            />
            <PWIcon
                name='star'
                onPress={onFavoriteRequested}
                variant='primary'
            />
        </PWView>
    )
}
