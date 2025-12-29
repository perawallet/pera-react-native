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

import { JsonRpcErrorCode } from '@hooks/webview'
import { logger } from '@perawallet/wallet-core-shared'
import WebView from 'react-native-webview'

export const requireSecure = (
    securedConnection: boolean,
    handler: () => void,
) => {
    if (!securedConnection) {
        // we return silently since the caller shouldn't be here anyway
        return
    }
    handler()
}

export const sendMessageToWebview = (
    id: string,
    payload: unknown,
    webview: WebView | null,
) => {
    const message = `window.postMessage(${JSON.stringify({
        id,
        jsonrpc: '2.0',
        result: payload,
    })});`
    logger.debug('Sending webview interface response', { message, webview })
    webview?.injectJavaScript(message)
}

export const sendErrorToWebview = (
    id: string,
    code: JsonRpcErrorCode,
    error: string,
    webview: WebView | null,
) => {
    const message = `window.postMessage(${JSON.stringify({
        id,
        jsonrpc: '2.0',
        error: {
            code,
            message: error,
        },
    })});`
    logger.debug('Sending webview interface error', { message, webview })
    webview?.injectJavaScript(message)
}
