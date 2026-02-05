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
import React, { useCallback, useMemo, useRef, useState } from 'react'
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
import { useToast } from '@hooks/useToast'
import { useStyles } from './styles'
import { usePeraWebviewInterface } from '@hooks/usePeraWebviewInterface'
import { EmptyView } from '@components/EmptyView'
import { PWView, PWButton, bottomSheetNotifier } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { logger } from '@perawallet/wallet-core-shared'
import { WebViewTitleBar } from './WebViewTitleBar'
import { WebViewFooterBar } from './WebViewFooterBar'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useWebViewStore } from '../../hooks'

export type PWWebViewProps = {
    url: string
    enablePeraConnect: boolean
    requestId?: string
    showControls?: boolean
    onClose?: () => void
    onBack?: () => void
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark') => {
    const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme'
    return `updateTheme?.('${jsTheme}');`
}

export const PWWebView = (props: PWWebViewProps) => {
    const styles = useStyles()
    const {
        url,
        enablePeraConnect,
        requestId,
        showControls = false,
        onClose,
        onBack,
        ...rest
    } = props
    const { theme } = useTheme()
    const removeWebView = useWebViewStore(state => state.removeWebView)
    const webview = useRef<WebView>(null)
    const { showToast } = useToast()
    const [title, setTitle] = useState('')
    const [navigationState, setNavigationState] = useState<WebViewNativeEvent>()
    const isDarkMode = useIsDarkMode()
    const { t } = useLanguage()

    const isSecure = useMemo(() => {
        // TODO: We ultimately want to replace this with a more SRI style security method
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
            onClose?.()
            return
        }
        removeWebView(requestId)
    }, [onClose, requestId, removeWebView])

    const mobileInterface = usePeraWebviewInterface(
        webview.current,
        isSecure,
        onCloseRequested,
        onBack,
    )

    const handleEvent = useCallback(
        (event: WebViewMessageEvent) => {
            if (!enablePeraConnect) {
                return
            }

            const dataString = event.nativeEvent.data
            if (!dataString) {
                showToast(
                    {
                        title: 'Invalid message received',
                        body: `Pera Wallet mobile interface received an invalid event`,
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            }

            const data = JSON.parse(dataString)
            logger.debug('WebView: Received onMessage event', {
                data,
            })
            mobileInterface.handleMessage(data)
        },
        [showToast, mobileInterface],
    )

    const navigationStateChange = useCallback(
        (navState: WebViewNativeEvent) => {
            logger.debug('WebView: Navigation state change', { navState })
            setNavigationState(navState)
        },
        [],
    )

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        logger.debug('WebView: Loading', {
            url: event.nativeEvent.url,
            isSecure,
        })
    }, [])

    const loadCompleted = useCallback((event: WebViewNavigationEvent) => {
        logger.debug('WebView: Title', { title: event.nativeEvent.title })
        setTitle(event.nativeEvent.title)
    }, [])

    const reload = useCallback(() => {
        webview.current?.reload()
    }, [])

    const showLoadError = useCallback(
        (event: WebViewErrorEvent) => {
            showToast(
                {
                    title: 'Failed to load resource',
                    body: `${event.nativeEvent.url}`,
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        },
        [showToast],
    )

    const showError = useCallback(
        (event: WebViewHttpErrorEvent) => {
            showToast(
                {
                    title: event.nativeEvent.title,
                    body: `${event.nativeEvent.statusCode} - ${event.nativeEvent.description}`,
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        },
        [showToast],
    )

    const jsToLoad = useMemo(() => {
        let js = baseJS

        if (enablePeraConnect) {
            js += peraConnectJS
            js += peraMobileInterfaceJS
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
                    <PWView style={styles.absoluteFill}>
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    </PWView>
                )}
                renderError={() => {
                    return (
                        <PWView style={styles.absoluteFill}>
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
