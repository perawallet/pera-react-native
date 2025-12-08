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

import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { config } from '@perawallet/wallet-core-config'
import { useTheme } from '@rneui/themed'
import React, {
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    WebView,
    WebViewMessageEvent,
    WebViewProps,
} from 'react-native-webview'
import {
    WebViewErrorEvent,
    WebViewHttpErrorEvent,
    WebViewNativeEvent,
    WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes'
import {
    baseJS,
    peraConnectJS,
    peraMobileInterfaceJS,
} from './injected-scripts'
import useToast from '../../hooks/toast'
import { StyleSheet } from 'react-native'
import { useStyles } from './styles'
import PWView from '../common/view/PWView'
import { usePeraWebviewInterface } from '../../hooks/webview'
import EmptyView from '../common/empty-view/EmptyView'
import PWButton from '../common/button/PWButton'
import LoadingView from '../common/loading/LoadingView'
import { debugLog } from '@perawallet/wallet-core-shared'
import WebViewTitleBar from './WebViewTitleBar'
import WebViewFooterBar from './WebViewFooterBar'
import { WebViewContext } from '../../providers/WebViewProvider'
import { useIsDarkMode } from '../../hooks/theme'
import { useLanguage } from '../../hooks/useLanguage'

export type PWWebViewProps = {
    url: string
    enablePeraConnect: boolean
    requestId?: string
    showControls?: boolean
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark') => {
    const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme'
    return `if (updateTheme) { updateTheme('${jsTheme}'); }`
}

const PWWebView = (props: PWWebViewProps) => {
    const styles = useStyles(props)
    const {
        url,
        enablePeraConnect,
        requestId,
        showControls = false,
        ...rest
    } = props
    const { removeWebView } = useContext(WebViewContext)
    const { theme } = useTheme()
    const webview = useRef<WebView>(null)
    const { showToast } = useToast()
    const [title, setTitle] = useState('')
    const [navigationState, setNavigationState] = useState<WebViewNativeEvent>()
    const isDarkMode = useIsDarkMode()
    const { t } = useLanguage()

    const isSecure = useMemo(() => {
        // TODO: We ultimately want to replace this with a more SRI style method
        return (
            url.startsWith(config.onrampBaseUrl) ||
            url.startsWith(config.discoverBaseUrl) ||
            url.startsWith(config.stakingBaseUrl)
        )
    }, [url])

    const deviceInfo = useDeviceInfoService()

    const userAgent = useMemo(() => {
        return `${deviceInfo.getUserAgent()}`
    }, [deviceInfo])

    const onCloseRequested = useCallback(() => {
        if (!requestId) {
            return
        }
        removeWebView(requestId)
    }, [removeWebView, requestId])

    const mobileInterface = usePeraWebviewInterface(
        webview.current,
        isSecure,
        onCloseRequested,
    )

    const handleEvent = useCallback(
        (event: WebViewMessageEvent) => {
            debugLog(
                'WebView: Received onMessage event',
                event.nativeEvent.data,
            )

            const dataString = event.nativeEvent.data
            if (!dataString) {
                showToast({
                    title: 'Invalid message received',
                    body: `Pera Wallet mobile interface received an invalid event`,
                    type: 'error',
                })
            }

            const data = JSON.parse(dataString)
            mobileInterface.handleMessage(data)
        },
        [showToast, mobileInterface],
    )

    const navigationStateChange = useCallback(
        (navState: WebViewNativeEvent) => {
            debugLog('WebView: Navigation state change', navState)
            setNavigationState(navState)
        },
        [],
    )

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        debugLog('WebView: Loading', event.nativeEvent.url, 'secure:', isSecure)
    }, [])

    const loadCompleted = useCallback((event: WebViewNavigationEvent) => {
        debugLog('WebView: Title', event.nativeEvent.title)
        setTitle(event.nativeEvent.title)
    }, [])

    const reload = useCallback(() => {
        webview.current?.reload()
    }, [])

    const showLoadError = useCallback(
        (event: WebViewErrorEvent) => {
            showToast({
                title: 'Failed to load resource',
                body: `${event.nativeEvent.url}`,
                type: 'error',
            })
        },
        [showToast],
    )

    const showError = useCallback(
        (event: WebViewHttpErrorEvent) => {
            showToast({
                title: event.nativeEvent.title,
                body: `${event.nativeEvent.statusCode} - ${event.nativeEvent.description}`,
                type: 'error',
            })
        },
        [showToast],
    )

    const jsToLoad = useMemo(() => {
        let js = baseJS

        if (enablePeraConnect) {
            js += ';' + peraConnectJS
            js += ';' + peraMobileInterfaceJS
        }

        js += updateTheme(theme.mode)

        return js
    }, [enablePeraConnect, theme.mode])

    return (
        <PWView style={styles.flex}>
            {showControls && (
                <WebViewTitleBar
                    onCloseRequested={onCloseRequested}
                    onReload={reload}
                    title={title}
                    url={url}
                />
            )}
            <WebView
                ref={webview}
                {...rest}
                source={{
                    uri: url,
                }}
                style={styles.webview}
                renderLoading={() => (
                    <PWView style={StyleSheet.absoluteFillObject}>
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    </PWView>
                )}
                renderError={() => {
                    return (
                        <PWView style={StyleSheet.absoluteFillObject}>
                            <EmptyView
                                title={t('common.webview.failed_title')}
                                body={t('common.webview.failed_body')}
                                button={
                                    <PWButton
                                        title={t('common.webview.reload')}
                                        onPress={reload}
                                        variant='primary'
                                    />
                                }
                            />
                        </PWView>
                    )
                }}
                containerStyle={styles.container}
                startInLoadingState
                onMessage={handleEvent}
                webviewDebuggingEnabled={config.debugEnabled}
                pullToRefreshEnabled={true}
                injectedJavaScript={jsToLoad}
                setSupportMultipleWindows={false}
                userAgent={userAgent}
                forceDarkOn={isDarkMode}
                onLoadStart={verifyLoad}
                onLoad={loadCompleted}
                onLoadSubResourceError={showLoadError}
                onError={showLoadError}
                onHttpError={showError}
                dataDetectorTypes={[]}
                textInteractionEnabled={false}
                onNavigationStateChange={navigationStateChange}
            />
            {showControls && (
                <WebViewFooterBar
                    webview={webview}
                    homeUrl={url}
                    navigationState={navigationState}
                />
            )}
        </PWView>
    )
}

export default PWWebView
