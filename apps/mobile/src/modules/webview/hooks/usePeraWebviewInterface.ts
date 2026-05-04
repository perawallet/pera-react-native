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

/* eslint-disable max-lines */

import WebView from 'react-native-webview'
import { useToast } from '@hooks/useToast'
import { Linking } from 'react-native'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    useNetwork,
    PeraSignedTransaction,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    getAccountDisplayName,
    useAllAccountLogicalTypes,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useCallback } from 'react'
import { useWebView } from './useWebViewStore'
import { useLanguage } from '@hooks/useLanguage'
import {
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type SignRequestSource,
    type TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    JsonRpcErrorCode,
    requireSecure,
    sendErrorToWebview,
    sendMessageToWebview,
} from './handlers'
import {
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useDeepLink } from '@hooks/useDeepLink'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { parseWalletConnectUri } from '@hooks/deeplink/walletconnect-parser'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

type WebviewMessage = {
    id: string
    jsonrpc: '2.0'
    method: string
    params?: Record<string, unknown>
}

export const usePeraWebviewInterface = (
    webview: Nullable<WebView>,
    securedConnection: boolean,
    sourceUrl: string | null,
    onCloseRequested?: () => void,
    onBackRequested?: () => void,
) => {
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const logicalTypes = useAllAccountLogicalTypes()
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const darkmode = useIsDarkMode()
    const theme = darkmode ? 'dark' : 'light'
    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo
    const { preferredCurrency } = useCurrency()
    const analytics = provider.analytics
    const { t } = useLanguage()
    const { pushWebView: pushWebViewContext } = useWebView()
    const { addSignRequest } = useSigningRequest()
    const { connect } = useWalletConnect(network)
    const { decodeTransactions, encodeSignedTransaction } =
        useTransactionEncoder()
    const { handleDeepLink } = useDeepLink()

    const hadRequiredParams = useCallback(
        (requiredParams: string[], message: WebviewMessage) => {
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

    const pushWebView = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'pushWebView',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    pushWebViewContext({
                        url: message.params!.url as string,
                        onCloseRequested,
                        onBackRequested,
                        id: message.id,
                        enablePeraConnect: true,
                    })
                },
            )
        },
        [
            pushWebViewContext,
            securedConnection,
            sourceUrl,
            onCloseRequested,
            onBackRequested,
            hadRequiredParams,
            webview,
        ],
    )

    const openSystemBrowser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'openSystemBrowser',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['url'], message)) {
                        return
                    }
                    Linking.canOpenURL(message.params!.url as string).then(
                        supported => {
                            if (supported) {
                                Linking.openURL(message.params?.url as string)
                            } else {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InvalidParams,
                                    t('errors.webview.unsupported_url', {
                                        url: message.params?.url,
                                    }),
                                    webview,
                                )
                            }
                        },
                    )
                },
            )
        },
        [securedConnection, sourceUrl, hadRequiredParams, t, webview],
    )

    const canOpenURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'canOpenURI',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['uri'], message)) {
                        return
                    }
                    Linking.canOpenURL(message.params!.uri as string).then(
                        supported => {
                            sendMessageToWebview(
                                message.id,
                                { supported },
                                webview,
                            )
                        },
                    )
                },
            )
        },
        [securedConnection, sourceUrl, hadRequiredParams, webview],
    )

    const openNativeURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'openNativeURI',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['uri'], message)) {
                        return
                    }
                    const uri = message.params!.uri as string

                    if (parseDeeplink(uri)) {
                        handleDeepLink(uri, false, 'deeplink')
                        return
                    }

                    Linking.canOpenURL(uri)
                        .then(supported => {
                            if (supported) {
                                Linking.openURL(uri)
                            } else {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InvalidParams,
                                    t('errors.webview.unsupported_url', {
                                        url: uri,
                                    }),
                                    webview,
                                )
                            }
                        })
                        .catch(() => {
                            sendErrorToWebview(
                                message.id,
                                JsonRpcErrorCode.InvalidParams,
                                t('errors.webview.unsupported_url', {
                                    url: uri,
                                }),
                                webview,
                            )
                        })
                },
            )
        },
        [
            securedConnection,
            sourceUrl,
            hadRequiredParams,
            handleDeepLink,
            t,
            webview,
        ],
    )

    const notifyUser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'notifyUser',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['type'], message)) {
                        return
                    }
                    if (message.params?.type === 'message') {
                        showToast({
                            title: '',
                            body: message.params?.message as string,
                            type: 'info',
                        })
                    }
                    //TODO add haptic (and maybe message.banner) support and maybe sound
                },
            )
        },
        [securedConnection, sourceUrl, webview, hadRequiredParams, showToast],
    )

    const getAddresses = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'getAddresses',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    const payload = accounts.map(a => ({
                        name: getAccountDisplayName(a),
                        address: a.address,
                        type: logicalTypes.get(a.address) ?? 'NoAuth',
                    }))
                    sendMessageToWebview(message.id, payload, webview)
                },
            )
        },
        [securedConnection, sourceUrl, accounts, webview],
    )

    const getSettings = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'getSettings',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    const payload = {
                        appName: deviceInfo.getAppName(),
                        appPackageName: deviceInfo.getAppPackage(),
                        appVersion: deviceInfo.getAppVersion(),
                        clientType: deviceInfo.getDevicePlatform(),
                        deviceId: deviceID,
                        deviceVersion: deviceInfo.getDeviceModel(),
                        deviceOSVersion: deviceInfo.getDevicePlatform(),
                        deviceModel: deviceInfo.getDeviceModel(),
                        theme,
                        network,
                        currency: preferredCurrency,
                        region: deviceInfo.getDeviceCountry(),
                        language: deviceInfo.getDeviceLocale(),
                        protocolVersion: '3',
                    }
                    sendMessageToWebview(message.id, payload, webview)
                },
            )
        },
        [
            deviceID,
            deviceInfo,
            preferredCurrency,
            securedConnection,
            sourceUrl,
            theme,
            network,
            webview,
        ],
    )

    const requestTransactionSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'requestTransactionSigning',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['txns', 'metadata'], message)) {
                        return
                    }
                    const rawTxns = message.params![
                        'txns'
                    ] as Nullable<string>[]
                    const txns = decodeTransactions(
                        rawTxns
                            .filter((t): t is string => t !== null)
                            .map(t => decodeFromBase64(t)),
                    )
                    const metadata = message.params![
                        'metadata'
                    ] as SignRequestSource

                    try {
                        addSignRequest({
                            id: generateOrderedUniqueId(),
                            type: 'transactions',
                            transport: 'callback',
                            txs: txns,
                            transportId: message.id,
                            sourceMetadata: metadata,
                            approve: async (
                                signed: PeraSignedTransaction[],
                            ) => {
                                sendMessageToWebview(
                                    message.id,
                                    {
                                        signedTxs: signed.map(s =>
                                            encodeToBase64(
                                                encodeSignedTransaction(s),
                                            ),
                                        ),
                                    },
                                    webview,
                                )
                            },
                            reject: async () => {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    'User rejected',
                                    webview,
                                )
                            },
                            error: async (err: Error) =>
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    err,
                                    webview,
                                ),
                        } as TransactionSignRequest)
                    } catch (e) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            e as Error,
                            webview,
                        )
                        // guardrails-ignore-next-line no-error-toast-in-catch reason: dApp signing path surfaces raw error message verbatim for diagnosis
                        showToast({
                            title: t('errors.signing.title'),
                            body: (e as Error).message,
                            type: 'error',
                        })
                    }
                },
            )
        },
        [securedConnection, sourceUrl, webview],
    )

    //TODO handle arc60 here
    const requestDataSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'requestDataSigning',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['data', 'metadata'], message)) {
                        return
                    }
                    const data = message.params![
                        'data'
                    ] as Partial<PeraArbitraryDataMessage>
                    const signer = data.signer

                    if (!signer) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InvalidParams,
                            t('errors.webview.invalid_params', {
                                params: 'signer',
                            }),
                            webview,
                        )
                        return
                    }
                    const metadata = message.params![
                        'metadata'
                    ] as SignRequestSource
                    try {
                        addSignRequest({
                            id: generateOrderedUniqueId(),
                            type: 'arbitrary-data',
                            transport: 'callback',
                            transportId: message.id,
                            sourceMetadata: metadata,
                            data: [data],
                            approve: async (
                                signed: PeraArbitraryDataSignResult[],
                            ) => {
                                sendMessageToWebview(
                                    message.id,
                                    signed.map(s =>
                                        encodeToBase64(s.signature),
                                    ),
                                    webview,
                                )
                            },
                            reject: async () => {
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    'User rejected',
                                    webview,
                                )
                            },
                            error: async (err: Error) =>
                                sendErrorToWebview(
                                    message.id,
                                    JsonRpcErrorCode.InternalError,
                                    err,
                                    webview,
                                ),
                        } as ArbitraryDataSignRequest)
                    } catch (e) {
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            e as Error,
                            webview,
                        )
                        // guardrails-ignore-next-line no-error-toast-in-catch reason: dApp signing path surfaces raw error message verbatim for diagnosis
                        showToast({
                            title: t('errors.signing.title'),
                            body: (e as Error).message,
                            type: 'error',
                        })
                    }
                },
            )
        },
        [securedConnection, sourceUrl, webview],
    )

    const getPublicSettings = useCallback(
        (message: WebviewMessage) => {
            const payload = {
                theme,
                network,
                currency: preferredCurrency,
                language: 'en-US', //TODO pull from app locale
            }
            sendMessageToWebview(message.id, payload, webview)
        },
        [preferredCurrency, theme, network, webview],
    )

    const openWalletConnect = useCallback(
        (message: WebviewMessage) => {
            if (!hadRequiredParams(['uri'], message)) {
                return
            }

            const rawUri = message.params!.uri as string
            const parsed = parseWalletConnectUri(rawUri)
            if (!parsed) {
                sendErrorToWebview(
                    message.id,
                    JsonRpcErrorCode.InvalidParams,
                    'Invalid WalletConnect URI',
                    webview,
                )
                return
            }

            connect({
                connection: {
                    uri: parsed.uri,
                    autoConnect: securedConnection,
                },
            })
        },
        [connect, securedConnection, hadRequiredParams, webview],
    )

    const onBackPressed = useCallback(() => {
        onBackRequested?.()
    }, [onBackRequested])

    const logAnalyticsEvent = useCallback(
        (message: WebviewMessage) => {
            requireSecure(
                securedConnection,
                {
                    operation: 'logAnalyticsEvent',
                    messageId: message.id,
                    sourceUrl,
                    webview,
                },
                () => {
                    if (!hadRequiredParams(['name', 'payload'], message)) {
                        return
                    }
                    analytics.logEvent(
                        message.params!.name as string,
                        message.params!.payload,
                    )
                },
            )
        },
        [analytics, securedConnection, sourceUrl, hadRequiredParams, webview],
    )

    const closeWebView = useCallback(() => {
        onCloseRequested?.()
    }, [onCloseRequested])

    const handleMessage = useCallback(
        (message: WebviewMessage | WebviewMessage[]) => {
            if (!Array.isArray(message)) {
                message = [message]
            }
            logger.debug('Received webview interface call', { message })
            message.forEach(message => {
                switch (message.method) {
                    case 'pushWebView':
                        pushWebView(message)
                        break
                    case 'openSystemBrowser':
                        openSystemBrowser(message)
                        break
                    case 'canOpenURI':
                        canOpenURI(message)
                        break
                    case 'openNativeURI':
                        openNativeURI(message)
                        break
                    case 'notifyUser':
                        notifyUser(message)
                        break
                    case 'getAddresses':
                        getAddresses(message)
                        break
                    case 'getSettings':
                        getSettings(message)
                        break
                    case 'getPublicSettings':
                        getPublicSettings(message)
                        break
                    case 'onBackPressed':
                        onBackPressed()
                        break
                    case 'logAnalyticsEvent':
                        logAnalyticsEvent(message)
                        break
                    case 'closeWebView':
                        closeWebView()
                        break
                    case 'requestTransactionSigning':
                        requestTransactionSigning(message)
                        break
                    case 'requestDataSigning':
                        requestDataSigning(message)
                        break
                    case 'walletConnect':
                        openWalletConnect(message)
                        break
                    default:
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.MethodNotFound,
                            t('errors.webview.invalid_method', {
                                method: message.method,
                            }),
                            webview,
                        )
                        break
                }
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
            getPublicSettings,
            onBackPressed,
            logAnalyticsEvent,
            closeWebView,
        ],
    )

    return {
        handleMessage,
    }
}
