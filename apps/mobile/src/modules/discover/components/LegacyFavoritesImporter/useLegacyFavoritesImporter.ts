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
import type {
    ShouldStartLoadRequest,
    WebViewMessageEvent,
} from 'react-native-webview/lib/WebViewTypes'
import { config } from '@perawallet/wallet-core-config'
import { isTrustedWebviewOrigin } from '@modules/webview'
import { useLegacyFavoritesImport } from '../../hooks/useLegacyFavoritesImport'

export type UseLegacyFavoritesImporterResult = {
    isActive: boolean
    onMessage: (event: WebViewMessageEvent) => void
    onError: () => void
    onHttpError: () => void
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean
}

/** The hidden reader WebView's handlers. */
export const useLegacyFavoritesImporter =
    (): UseLegacyFavoritesImporterResult => {
        const { isActive, onMessage, onFailure } = useLegacyFavoritesImport()

        const handleMessage = useCallback(
            (event: WebViewMessageEvent) => {
                let data: unknown
                try {
                    data = JSON.parse(event.nativeEvent.data)
                } catch {
                    // Unparseable: the import fails the attempt as malformed.
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

        return {
            isActive,
            onMessage: handleMessage,
            onError,
            onHttpError,
            onShouldStartLoadWithRequest,
        }
    }
