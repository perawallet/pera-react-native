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

import type { RefObject } from 'react'
import { PWView } from '@components/core/PWView'
import { PWIcon } from '@components/core/PWIcon'
import type WebView from 'react-native-webview'
import type { WebViewNativeEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { WebViewFavorite } from '@modules/webview/hooks'
import { useStyles } from './styles'
import { useWebViewFooterBar } from './useWebViewFooterBar'

export type WebViewFooterBarProps = {
    webview: RefObject<Nullable<WebView<unknown>>>
    homeUrl?: string
    navigationState?: WebViewNativeEvent
    favorite?: WebViewFavorite
    /** Bottom safe-area inset the footer must clear itself (0 when the host screen handles insets). */
    bottomInset: number
}

export const WebViewFooterBar = ({
    webview,
    homeUrl,
    navigationState,
    favorite,
    bottomInset,
}: WebViewFooterBarProps) => {
    const styles = useStyles({ bottomInset })
    const {
        isHome,
        canGoBack,
        canGoForward,
        showFavorite,
        isFavorite,
        onBackRequested,
        onForwardRequested,
        onHomeRequested,
        onFavoriteRequested,
    } = useWebViewFooterBar({ webview, homeUrl, navigationState, favorite })

    return (
        <PWView style={styles.footerBar}>
            <PWIcon
                name='chevron-left'
                onPress={onBackRequested}
                variant='primary'
                disabled={!canGoBack}
            />
            <PWIcon
                name='chevron-right'
                onPress={onForwardRequested}
                variant='primary'
                disabled={!canGoForward}
            />
            <PWIcon
                name='house'
                onPress={onHomeRequested}
                variant='primary'
                disabled={isHome}
            />
            {showFavorite ? (
                <PWIcon
                    name={isFavorite ? 'star-filled' : 'star'}
                    onPress={onFavoriteRequested}
                    variant={isFavorite ? 'favorite' : 'primary'}
                />
            ) : (
                <PWView />
            )}
        </PWView>
    )
}
