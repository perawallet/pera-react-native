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

import { useCallback, useMemo } from 'react'
import type {
    ShouldStartLoadRequest,
    WebViewMessageEvent,
} from 'react-native-webview/lib/WebViewTypes'
import { config } from '@perawallet/wallet-core-config'
import {
    HARDENED_WEBVIEW_PROPS,
    isTrustedWebviewOrigin,
} from '@modules/webview'
import { useLegacyFavoritesImport } from '../../hooks/useLegacyFavoritesImport'

export type LegacyFavoritesReaderProps = {
    source: { uri: string }
    originWhitelist: string[]
    onMessage: (event: WebViewMessageEvent) => void
    onError: () => void
    onHttpError: () => void
    onLoad: () => void
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
    thirdPartyCookiesEnabled: false
    mixedContentMode: 'never'
    setSupportMultipleWindows: false
} & typeof HARDENED_WEBVIEW_PROPS

export type UseLegacyFavoritesImporterResult = {
    isActive: boolean
    /** Every reader WebView prop except the injected script. */
    webViewProps: LegacyFavoritesReaderProps
}

/** The hidden reader WebView's handlers. */
export const useLegacyFavoritesImporter =
    (): UseLegacyFavoritesImporterResult => {
        const { isActive, onMessage, onFailure, onPageLoad } =
            useLegacyFavoritesImport()

        const handleMessage = useCallback(
            (event: WebViewMessageEvent) => {
                let data: unknown
                try {
                    data = JSON.parse(event.nativeEvent.data)
                } catch {
                    // Not JSON, so not the reader's: the import ignores it.
                    data = undefined
                }
                onMessage(event.nativeEvent.url, data)
            },
            [onMessage],
        )
        const onError = useCallback(() => onFailure('load_error'), [onFailure])
        const onHttpError = useCallback(
            () => onFailure('http_error'),
            [onFailure],
        )
        const onShouldStartLoadWithRequest = useCallback(
            (request: ShouldStartLoadRequest) =>
                isTrustedWebviewOrigin(request.url, [config.discoverBaseUrl]),
            [],
        )

        const webViewProps = useMemo(
            (): LegacyFavoritesReaderProps => ({
                // oxlint-disable-next-line pera/no-unvalidated-open-url -- config.discoverBaseUrl is the app's own trusted origin
                source: { uri: config.discoverBaseUrl },
                // Every scheme reaches the guard: under the default http(s)
                // whitelist a custom scheme would go straight to the OS.
                originWhitelist: ['*'],
                onMessage: handleMessage,
                onError,
                onHttpError,
                onLoad: onPageLoad,
                onShouldStartLoadWithRequest,
                thirdPartyCookiesEnabled: false,
                mixedContentMode: 'never',
                setSupportMultipleWindows: false,
                ...HARDENED_WEBVIEW_PROPS,
            }),
            [
                handleMessage,
                onError,
                onHttpError,
                onPageLoad,
                onShouldStartLoadWithRequest,
            ],
        )

        return { isActive, webViewProps }
    }
