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
import { JsonRpcErrorCode, sendErrorToWebview } from '../handlers'
import type { WebviewMessage } from './types'

export type HasRequiredParams = (
    requiredParams: string[],
    message: WebviewMessage,
) => boolean

/** Answers the page `-32602` naming the first missing (or falsy) param. */
export const useRequiredParams = (
    webview: Nullable<WebView>,
): HasRequiredParams => {
    const { t } = useLanguage()

    return useCallback(
        (requiredParams, message) => {
            for (const param of requiredParams) {
                if (!message.params?.[param]) {
                    sendErrorToWebview(
                        message.id,
                        JsonRpcErrorCode.InvalidParams,
                        t('errors.webview.invalid_params', { params: param }),
                        webview,
                    )
                    return false
                }
            }
            return true
        },
        [t, webview],
    )
}
