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
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { AnalyticsMetadataKey, WebviewEvent, trackEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import {
    JsonRpcErrorCode,
    requireSecure,
    sendErrorToWebview,
    type WebviewMessageSecurity,
} from './handlers'
import {
    isSupportedBridgeMethod,
    type PeraWebviewBridgeMethod,
} from './bridge-methods'
import type { BridgeRoute, WebviewMessage } from './bridge/types'
import { useDataSigningHandler } from './bridge/useDataSigningHandler'
import { useDeviceIdHandler } from './bridge/useDeviceIdHandler'
import { useExternalUriHandlers } from './bridge/useExternalUriHandlers'
import { useGetAddressesHandler } from './bridge/useGetAddressesHandler'
import { useHostNavigationHandlers } from './bridge/useHostNavigationHandlers'
import { useLogAnalyticsEventHandler } from './bridge/useLogAnalyticsEventHandler'
import { useNotifyUserHandler } from './bridge/useNotifyUserHandler'
import { usePushWebViewHandler } from './bridge/usePushWebViewHandler'
import { useSettingsHandlers } from './bridge/useSettingsHandlers'
import { useTransactionSigningHandler } from './bridge/useTransactionSigningHandler'
import { useWalletConnectHandler } from './bridge/useWalletConnectHandler'

export const usePeraWebviewInterface = (
    webview: Nullable<WebView>,
    securedConnection: boolean,
    sourceUrl: string | null,
    onCloseRequested?: () => void,
    onBackRequested?: () => void,
) => {
    const { t } = useLanguage()
    const pushWebView = usePushWebViewHandler({
        webview,
        onCloseRequested,
        onBackRequested,
    })
    const { openSystemBrowser, canOpenURI, openNativeURI } =
        useExternalUriHandlers(webview)
    const notifyUser = useNotifyUserHandler(webview)
    const getAddresses = useGetAddressesHandler(webview)
    const { getSettings, getPublicSettings } = useSettingsHandlers(webview)
    const getDeviceId = useDeviceIdHandler(webview, securedConnection)
    const { onBackPressed, closeWebView } = useHostNavigationHandlers({
        onCloseRequested,
        onBackRequested,
    })
    const logAnalyticsEvent = useLogAnalyticsEventHandler(webview)
    const requestTransactionSigning = useTransactionSigningHandler(
        webview,
        sourceUrl,
    )
    const requestDataSigning = useDataSigningHandler(webview, sourceUrl)
    const walletConnect = useWalletConnectHandler(webview, sourceUrl)

    const handleMessage = useCallback(
        (
            message: WebviewMessage | WebviewMessage[],
            // Native derives this per message (a message can race a
            // navigation); web's origin is mount-fixed. Omitting it falls back
            // to the mount-level decision.
            messageSecurity?: WebviewMessageSecurity,
        ) => {
            const messages = Array.isArray(message) ? message : [message]
            const security = messageSecurity ?? { securedConnection, sourceUrl }
            logger.debug('Received webview interface call', {
                message: messages,
            })
            // Keyed by the exported v3 method set so the compiler rejects a
            // route that drifts from PERA_WEBVIEW_BRIDGE_METHODS. The trust
            // column must match `requireSecure` in docs/WEBVIEW_ARCHITECTURE.md.
            const routes: Record<PeraWebviewBridgeMethod, BridgeRoute> = {
                pushWebView: {
                    handle: pushWebView,
                    requiresTrustedOrigin: true,
                },
                openSystemBrowser: {
                    handle: openSystemBrowser,
                    requiresTrustedOrigin: true,
                },
                canOpenURI: { handle: canOpenURI, requiresTrustedOrigin: true },
                openNativeURI: {
                    handle: openNativeURI,
                    requiresTrustedOrigin: true,
                },
                notifyUser: { handle: notifyUser, requiresTrustedOrigin: true },
                getAddresses: {
                    handle: getAddresses,
                    requiresTrustedOrigin: true,
                },
                getSettings: {
                    handle: getSettings,
                    requiresTrustedOrigin: true,
                },
                getDeviceId: {
                    handle: getDeviceId,
                    requiresTrustedOrigin: true,
                },
                getPublicSettings: {
                    handle: getPublicSettings,
                    requiresTrustedOrigin: false,
                },
                onBackPressed: {
                    handle: onBackPressed,
                    requiresTrustedOrigin: false,
                },
                logAnalyticsEvent: {
                    handle: logAnalyticsEvent,
                    requiresTrustedOrigin: true,
                },
                closeWebView: {
                    handle: closeWebView,
                    requiresTrustedOrigin: false,
                },
                requestTransactionSigning: {
                    handle: requestTransactionSigning,
                    requiresTrustedOrigin: true,
                },
                requestDataSigning: {
                    handle: requestDataSigning,
                    requiresTrustedOrigin: true,
                },
                walletConnect: {
                    handle: walletConnect,
                    requiresTrustedOrigin: false,
                },
            }
            messages.forEach(msg => {
                const { method } = msg
                if (!isSupportedBridgeMethod(method)) {
                    trackEvent(WebviewEvent.BridgeMethodNotFound, {
                        [AnalyticsMetadataKey.WebviewBridgeMethod]: method,
                        ...(security.sourceUrl
                            ? { [AnalyticsMetadataKey.Url]: security.sourceUrl }
                            : {}),
                    })
                    if (__DEV__) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[webview-bridge] Unknown method "${method}" from ${security.sourceUrl ?? 'unknown origin'} — not part of the v3 contract (docs/WEBVIEW_ARCHITECTURE.md)`,
                        )
                    }
                    sendErrorToWebview(
                        msg.id,
                        JsonRpcErrorCode.MethodNotFound,
                        t('errors.webview.invalid_method', { method }),
                        webview,
                    )
                    return
                }
                const route = routes[method]
                if (!route.requiresTrustedOrigin) {
                    route.handle(msg, security)
                    return
                }
                requireSecure(
                    security.securedConnection,
                    {
                        operation: method,
                        messageId: msg.id,
                        sourceUrl: security.sourceUrl,
                        webview,
                    },
                    () => route.handle(msg, security),
                )
            })
        },
        [
            pushWebView,
            openSystemBrowser,
            canOpenURI,
            openNativeURI,
            notifyUser,
            getAddresses,
            getSettings,
            getDeviceId,
            getPublicSettings,
            onBackPressed,
            logAnalyticsEvent,
            closeWebView,
            requestTransactionSigning,
            requestDataSigning,
            walletConnect,
            securedConnection,
            sourceUrl,
            webview,
            t,
        ],
    )

    return {
        handleMessage,
    }
}
