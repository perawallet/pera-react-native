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

import WebView from 'react-native-webview'
import useToast from './toast'
import { Linking } from 'react-native'
import {
    useAnalyticsService,
    useDeviceID,
    useDeviceInfoService,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useCallback, useContext } from 'react'
import { WebViewContext } from '../providers/WebViewProvider'

type PushNewScreenParams = {
    url: string
}

type PushInternalBrowserParams = {
    url: string
    name?: string
    projectId?: string
    isFavorite?: boolean
}

type OpenSystemBrowserParams = {
    url: string
}

type CanOpenURIParams = {
    uri: string
}

type NotifyUserParams = {
    type: 'haptic' | 'sound' | 'message'
    variant: string
    message?: string
}

type LogAnalyticsParams = {
    name: string
    payload: unknown
}

type WebviewMessage = {
    action: string
    params: Record<string, any>
}

export const usePeraWebviewInterface = (
    webview: WebView | null,
    securedConnection: boolean,
    onCloseRequested?: () => void,
) => {
    const { showToast } = useToast()
    const accounts = useAllAccounts()
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const { theme } = useSettings()
    const deviceInfo = useDeviceInfoService()
    const { preferredCurrency } = useCurrency()
    const analytics = useAnalyticsService()
    const { pushWebView: pushWebViewContext } = useContext(WebViewContext)

    const sendMessageToWebview = useCallback(
        (payload: unknown) => {
            const message = `handleMessage(${JSON.stringify(payload)});`
            webview?.injectJavaScript(message)
        },
        [webview],
    )

    const pushWebView = useCallback(
        (params: PushInternalBrowserParams) => {
            pushWebViewContext({
                url: params.url,
                id: '',
            })
        },
        [pushWebViewContext],
    )

    const openSystemBrowser = useCallback(
        (params: OpenSystemBrowserParams) => {
            Linking.canOpenURL(params.url).then(supported => {
                if (supported) {
                    Linking.openURL(params.url)
                } else {
                    showToast({
                        title: "Can't open webpage",
                        body: "The page you're viewing has sent an invalid message format.",
                        type: 'error',
                    })
                }
            })
        },
        [showToast],
    )

    const canOpenURI = useCallback((params: CanOpenURIParams) => {
        Linking.canOpenURL(params.uri).then(supported => {
            sendMessageToWebview(supported)
        })
    }, [])

    const openNativeURI = useCallback(
        (params: CanOpenURIParams) => {
            Linking.canOpenURL(params.uri).then(supported => {
                if (supported) {
                    Linking.openURL(params.uri)
                } else {
                    showToast({
                        title: "Can't open URI",
                        body: "The page you're viewing has sent an invalid message format.",
                        type: 'error',
                    })
                }
            })
        },
        [showToast],
    )

    const notifyUser = useCallback(
        (params: NotifyUserParams) => {
            if (params.type === 'message') {
                showToast({
                    title: '',
                    body: params.message ?? '',
                    type: 'info',
                })
            }
            //TODO add haptic (and maybe message.banner) support and maybe sound
        },
        [showToast],
    )

    const getAddresses = useCallback(() => {
        const payload = accounts.map(a => ({
            name: getAccountDisplayName(a),
            address: a.address,
            type: 'HdKey', //TODO support other types also
        }))
        sendMessageToWebview(payload)
    }, [accounts, webview])

    const getSettings = useCallback(() => {
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
        sendMessageToWebview(payload)
    }, [webview])

    const getPublicSettings = useCallback(() => {
        const payload = {
            theme,
            network,
            currency: preferredCurrency,
            language: 'en-US', //TODO pull from app locale
        }
        sendMessageToWebview(payload)
    }, [webview])

    //TODO not sure what the correct behavior here is?
    const onBackPressed = useCallback(() => {}, [])

    const logAnalyticsEvent = useCallback(
        (params: LogAnalyticsParams) => {
            analytics.logEvent(params.name, params.payload)
        },
        [analytics],
    )

    const closeWebView = useCallback(() => {
        onCloseRequested?.()
    }, [onCloseRequested])

    const handleMessage = useCallback(
        ({ action, params }: WebviewMessage) => {
            switch (action) {
                case 'pushWebView':
                    if (securedConnection) {
                        pushWebView(params as PushNewScreenParams)
                    }
                    break
                case 'openSystemBrowser':
                    if (securedConnection) {
                        openSystemBrowser(params as OpenSystemBrowserParams)
                    }
                    break
                case 'canOpenURI':
                    if (securedConnection) {
                        canOpenURI(params as CanOpenURIParams)
                    }
                    break
                case 'openNativeURI':
                    if (securedConnection) {
                        openNativeURI(params as CanOpenURIParams)
                    }
                    break
                case 'notifyUser':
                    if (securedConnection) {
                        notifyUser(params as NotifyUserParams)
                    }
                    break
                case 'getAddresses':
                    if (securedConnection) {
                        getAddresses()
                    }
                    break
                case 'getSettings':
                    if (securedConnection) {
                        getSettings()
                    }
                    break
                case 'getPublicSettings':
                    getPublicSettings()
                    break
                case 'onBackPressed':
                    if (securedConnection) {
                        onBackPressed()
                    }
                    break
                case 'logAnalyticsEvent':
                    if (securedConnection) {
                        logAnalyticsEvent(params as LogAnalyticsParams)
                    }
                    break
                case 'closeWebView':
                    if (securedConnection) {
                        closeWebView()
                    }
                    break
                default:
                    showToast({
                        title: 'Invalid message received.',
                        body: "The page you're viewing has sent an invalid message format.",
                        type: 'error',
                    })
                    break
            }
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
