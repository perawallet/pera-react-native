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
