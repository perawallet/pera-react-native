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
import { useToast } from './toast'
import { Linking } from 'react-native'
import {
    useAnalyticsService,
    useDeviceID,
    useDeviceInfoService,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import {
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useCallback } from 'react'
import { useWebView } from '@modules/webview'
import { useLanguage } from './language'
import {
    ArbitraryDataSignRequest,
    PeraArbitraryDataMessage,
    PeraArbitraryDataSignResult,
    PeraSignedTransactionGroup,
    PeraTransaction,
    SignRequestSource,
    TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import {
    requireSecure,
    sendErrorToWebview,
    sendMessageToWebview,
} from './webview/handlers'
import { logger } from '@perawallet/wallet-core-shared'
import { getAccountType } from './webview/utils'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'
import { v7 as uuid } from 'uuid'

type WebviewMessage = {
    id: string
    jsonrpc: '2.0'
    method: string
    params?: Record<string, unknown>
}

export const JsonRpcErrorCode = {
    ParseError: -32700,
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603,
    ServerErrorStart: -32000,
    ServerErrorEnd: -32099,
} as const

export type JsonRpcErrorCode =
    (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode]

export { useWebView } from '@modules/webview'

export const usePeraWebviewInterface = (
    webview: WebView | null,
    securedConnection: boolean,
    onCloseRequested?: () => void,
    onBackRequested?: () => void,
) => {
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const { theme } = useSettings()
    const deviceInfo = useDeviceInfoService()
    const { preferredCurrency } = useCurrency()
    const analytics = useAnalyticsService()
    const { t } = useLanguage()
    const { pushWebView: pushWebViewContext } = useWebView()
    const { addSignRequest } = useSigningRequest()
    const { connect } = useWalletConnect()

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
            requireSecure(securedConnection, () => {
                if (!hadRequiredParams(['url'], message)) {
                    return
                }
                pushWebViewContext({
                    url: message.params!.url as string,
                    onCloseRequested,
                    onBackRequested,
                    id: message.id,
                })
            })
        },
        [pushWebViewContext, t, webview],
    )

    const openSystemBrowser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
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
            })
        },
        [securedConnection, t, webview],
    )

    const canOpenURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                if (!hadRequiredParams(['uri'], message)) {
                    return
                }
                Linking.canOpenURL(message.params!.uri as string).then(
                    supported => {
                        sendMessageToWebview(message.id, { supported }, webview)
                    },
                )
            })
        },
        [securedConnection, t, webview],
    )

    const openNativeURI = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                if (!hadRequiredParams(['uri'], message)) {
                    return
                }
                Linking.canOpenURL(message.params!.uri as string).then(
                    supported => {
                        if (supported) {
                            Linking.openURL(message.params?.uri as string)
                        } else {
                            sendErrorToWebview(
                                message.id,
                                JsonRpcErrorCode.InvalidParams,
                                t('errors.webview.unsupported_url', {
                                    url: message.params?.uri,
                                }),
                                webview,
                            )
                        }
                    },
                )
            })
        },
        [securedConnection, t, webview],
    )

    const notifyUser = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
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
            })
        },
        [securedConnection, showToast],
    )

    const getAddresses = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                const payload = accounts.map(a => ({
                    name: getAccountDisplayName(a),
                    address: a.address,
                    type: getAccountType(a),
                }))
                sendMessageToWebview(message.id, payload, webview)
            })
        },
        [securedConnection, accounts, webview],
    )

    const getSettings = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                const payload = {
                    //TODO make some more of this configurable and/or add to deviceInfo
                    appName: 'Pera Wallet',
                    appPackageName: 'pera-rn',
                    appVersion: deviceInfo.getAppVersion(),
                    clientType: deviceInfo.getDevicePlatform(),
                    deviceId: deviceID,
                    deviceVersion: deviceInfo.getDeviceModel(),
                    deviceOSVersion: deviceInfo.getDevicePlatform(),
                    deviceModel: deviceInfo.getDeviceModel(),
                    theme,
                    network,
                    currency: preferredCurrency,
                    region: 'en-US', //TODO pull from state eventually (or device location or something)
                    language: 'en-US', //TODO pull from app locale
                }
                sendMessageToWebview(message.id, payload, webview)
            })
        },
        [
            deviceID,
            deviceInfo,
            preferredCurrency,
            securedConnection,
            theme,
            network,
            webview,
        ],
    )

    const requestTransactionSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                if (
                    !hadRequiredParams(['txns', 'metadata', 'address'], message)
                ) {
                    return
                }
                const txns = message.params![
                    'txns'
                ] as (PeraTransaction | null)[]
                const metadata = message.params![
                    'metadata'
                ] as SignRequestSource
                const address = message.params!['address'] as string
                addSignRequest({
                    id: uuid(),
                    type: 'transactions',
                    transport: 'callback',
                    txs: [txns],
                    transportId: message.id,
                    addresses: [address],
                    sourceMetadata: metadata,
                    approve: async (signed: PeraSignedTransactionGroup[]) => {
                        sendMessageToWebview(
                            message.id,
                            {
                                signedTxs: signed,
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
                    error: async (err: string) =>
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            err,
                            webview,
                        ),
                } as TransactionSignRequest)
            })
        },
        [securedConnection, sendErrorToWebview, sendMessageToWebview, webview],
    )

    //TODO handle arc60 here
    const requestDataSigning = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                if (!hadRequiredParams(['data', 'metadata'], message)) {
                    return
                }
                const dataMessage = message.params![
                    'data'
                ] as PeraArbitraryDataMessage
                const metadata = message.params![
                    'metadata'
                ] as SignRequestSource
                addSignRequest({
                    id: uuid(),
                    type: 'arbitrary-data',
                    transport: 'callback',
                    transportId: message.id,
                    sourceMetadata: metadata,
                    data: [dataMessage],
                    approve: async (signed: PeraArbitraryDataSignResult[]) => {
                        sendMessageToWebview(
                            message.id,
                            signed.map(s => s.signature),
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
                    error: async (err: string) =>
                        sendErrorToWebview(
                            message.id,
                            JsonRpcErrorCode.InternalError,
                            err,
                            webview,
                        ),
                } as ArbitraryDataSignRequest)
            })
        },
        [securedConnection, sendErrorToWebview, sendMessageToWebview, webview],
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

            connect({
                connection: {
                    uri: message.params!.uri as string,
                    autoConnect: securedConnection,
                },
            })
        },
        [connect, securedConnection, webview],
    )

    const onBackPressed = useCallback(() => {
        onBackRequested?.()
    }, [onBackRequested])

    const logAnalyticsEvent = useCallback(
        (message: WebviewMessage) => {
            requireSecure(securedConnection, () => {
                if (!hadRequiredParams(['name', 'payload'], message)) {
                    return
                }
                analytics.logEvent(
                    message.params!.name as string,
                    message.params!.payload,
                )
            })
        },
        [analytics, securedConnection],
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
