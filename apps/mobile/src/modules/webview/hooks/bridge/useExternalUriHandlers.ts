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
import type WebView from 'react-native-webview'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useDeepLink, parseDeeplink } from '@modules/deeplink'
import { useLanguage } from '@hooks/useLanguage'
import {
    JsonRpcErrorCode,
    sendErrorToWebview,
    sendMessageToWebview,
    toValidatedBrowserUrl,
    toValidatedNativeUri,
} from '../handlers'
import type { BridgeHandler } from './types'
import { useRequiredParams } from './useRequiredParams'

type UseExternalUriHandlersResult = {
    openSystemBrowser: BridgeHandler
    canOpenURI: BridgeHandler
    openNativeURI: BridgeHandler
}

export const useExternalUriHandlers = (
    webview: Nullable<WebView>,
): UseExternalUriHandlersResult => {
    const { t } = useLanguage()
    const { handleDeepLink } = useDeepLink()
    const hasRequiredParams = useRequiredParams(webview)

    const sendUnsupportedUrl = useCallback(
        (messageId: string, url: string) =>
            sendErrorToWebview(
                messageId,
                JsonRpcErrorCode.InvalidParams,
                t('errors.webview.unsupported_url', { url }),
                webview,
            ),
        [t, webview],
    )

    const openSystemBrowser = useCallback<BridgeHandler>(
        message => {
            if (!hasRequiredParams(['url'], message)) {
                return
            }
            const rawUrl = message.params!.url
            // https-only until product confirms a broader allow-list.
            // canOpenURL is a no-op on web (always resolves true), so this
            // gate is the only one there.
            const url = toValidatedBrowserUrl(rawUrl)
            if (!url) {
                sendUnsupportedUrl(message.id, String(rawUrl))
                return
            }
            void Linking.canOpenURL(url).then(supported => {
                if (supported) {
                    // oxlint-disable-next-line pera/no-unvalidated-open-url -- toValidatedBrowserUrl above
                    void Linking.openURL(url)
                } else {
                    sendUnsupportedUrl(message.id, url)
                }
            })
        },
        [hasRequiredParams, sendUnsupportedUrl],
    )

    const canOpenURI = useCallback<BridgeHandler>(
        message => {
            if (!hasRequiredParams(['uri'], message)) {
                return
            }
            void Linking.canOpenURL(message.params!.uri as string).then(
                supported => {
                    sendMessageToWebview(message.id, { supported }, webview)
                },
            )
        },
        [hasRequiredParams, webview],
    )

    const openNativeURI = useCallback<BridgeHandler>(
        message => {
            if (!hasRequiredParams(['uri'], message)) {
                return
            }
            const rawUri = message.params!.uri

            if (typeof rawUri === 'string' && parseDeeplink(rawUri)) {
                void handleDeepLink(rawUri, false, 'in-app')
                return
            }

            const uri = toValidatedNativeUri(rawUri)
            if (!uri) {
                sendUnsupportedUrl(message.id, String(rawUri))
                return
            }

            void Linking.canOpenURL(uri)
                .then(supported => {
                    if (supported) {
                        // oxlint-disable-next-line pera/no-unvalidated-open-url -- toValidatedNativeUri above
                        void Linking.openURL(uri)
                    } else {
                        sendUnsupportedUrl(message.id, uri)
                    }
                })
                .catch(() => {
                    sendUnsupportedUrl(message.id, uri)
                })
        },
        [hasRequiredParams, handleDeepLink, sendUnsupportedUrl],
    )

    return { openSystemBrowser, canOpenURI, openNativeURI }
}
