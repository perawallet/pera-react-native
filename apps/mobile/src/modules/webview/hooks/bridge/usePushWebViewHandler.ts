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
import type WebView from 'react-native-webview'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import {
    BROWSER_FAVORITE_ACTION,
    JsonRpcErrorCode,
    sendActionToWebview,
    sendErrorToWebview,
    toValidatedBrowserUrl,
} from '../handlers'
import { useWebView } from '../useWebViewStore'
import type { BridgeHandler } from './types'
import { useRequiredParams } from './useRequiredParams'

type UsePushWebViewHandlerParams = {
    webview: Nullable<WebView>
    onCloseRequested?: () => void
    onBackRequested?: () => void
}

export const usePushWebViewHandler = ({
    webview,
    onCloseRequested,
    onBackRequested,
}: UsePushWebViewHandlerParams): BridgeHandler => {
    const { t } = useLanguage()
    const { pushWebView: pushWebViewContext } = useWebView()
    const hasRequiredParams = useRequiredParams(webview)

    return useCallback(
        message => {
            if (!hasRequiredParams(['url'], message)) {
                return
            }
            const rawUrl = message.params!.url
            // Normalize before the https-only gate so a bare domain typed into
            // the Discover URL bar ("perawallet.app") still opens; unsafe
            // schemes stay rejected.
            const url = toValidatedBrowserUrl(rawUrl)
            if (!url) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    t('errors.webview.unsupported_url', {
                        url: String(rawUrl),
                    }),
                    webview,
                )
                return
            }
            const title = message.params?.title as string | undefined
            const isFavorite = message.params?.isFavorite

            // The host (Discover) sends `isFavorite` only for pages that
            // support favoriting; without it the footer shows no star.
            // onToggle asks the source webview — where favorites persistence
            // lives — to flip the page's favorite state.
            const favorite =
                typeof isFavorite === 'boolean'
                    ? {
                          initialIsFavorite: isFavorite,
                          onToggle: () =>
                              sendActionToWebview(
                                  BROWSER_FAVORITE_ACTION,
                                  { name: title ?? '', url, logo: null },
                                  webview,
                              ),
                      }
                    : undefined

            pushWebViewContext({
                url,
                onCloseRequested,
                onBackRequested,
                id: message.id,
                enablePeraConnect: true,
                favorite,
            })
        },
        [
            pushWebViewContext,
            onCloseRequested,
            onBackRequested,
            hasRequiredParams,
            t,
            webview,
        ],
    )
}
