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
import {
    useContextFingerprints,
    usePeraWebviewInterface,
} from '@modules/webview/hooks'
import { isTrustedWebviewOrigin } from '@modules/webview/hooks/handlers'
import { useNotifyWebViewOnContextChange } from '@modules/webview/hooks/useNotifyWebViewOnContextChange'
import { EmptyView } from '@components/EmptyView'
import {
    PWView,
    PWButton,
    bottomSheetNotifier,
    PWScrollView,
} from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { logger } from '@perawallet/wallet-core-shared'
import { WebViewTitleBar } from './WebViewTitleBar'
import { WebViewFooterBar } from './WebViewFooterBar'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useWebViewStore } from '../../hooks'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

export type PWWebViewProps = {
    url: string
    enablePeraConnect: boolean
    requestId?: string
    showControls?: boolean
    onClose?: () => void
    onBack?: () => void
    inBottomSheet?: boolean
    customJavaScript?: string
    onCustomMessage?: (data: unknown) => void
    webviewRef?: React.RefObject<WebView | null>
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
        customJavaScript,
        onCustomMessage,
        webviewRef,
        ...rest
    } = props
    const { theme } = useTheme()
    const removeWebView = useWebViewStore(state => state.removeWebView)
    const internalRef = useRef<WebView>(null)
    const webview = webviewRef ?? internalRef
    const { showToast } = useToast()
    const [title, setTitle] = useState('')
    const [navigationState, setNavigationState] = useState<WebViewNativeEvent>()
    const isDarkMode = useIsDarkMode()
    const { t } = useLanguage()
    const contextFingerprints = useContextFingerprints()
    useNotifyWebViewOnContextChange(
        webview,
        enablePeraConnect ? contextFingerprints : undefined,
    )

    const isSecure = useMemo(
        () =>
            isTrustedWebviewOrigin(url, [
                config.onrampBaseUrl,
                config.discoverBaseUrl,
            ]),
        [url],
    )

    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo

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
        url,
        onCloseRequested,
        onBack,
    )

    const handleEvent = useCallback(
        (event: WebViewMessageEvent) => {
            const dataString = event.nativeEvent.data
            if (!dataString) {
                return
            }

            let data: unknown
            try {
                data = JSON.parse(dataString)
            } catch {
                return
            }

            if (onCustomMessage) {
                onCustomMessage(data)
                return
            }

            if (!enablePeraConnect) {
                return
            }

            logger.debug('WebView: Received onMessage event', {
                data,
            })
            mobileInterface.handleMessage(
                data as Parameters<typeof mobileInterface.handleMessage>[0],
            )
        },
        [onCustomMessage, enablePeraConnect, mobileInterface],
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

        if (customJavaScript) {
            js += customJavaScript
        }

        js += updateTheme(theme.mode)

        return js
    }, [enablePeraConnect, customJavaScript, theme.mode])

    const renderWebView = useCallback(() => {
        return (
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
                onNavigationStateChange={navigationStateChange}
                nestedScrollEnabled
            />
        )
    }, [
        reload,
        handleEvent,
        verifyLoad,
        loadCompleted,
        showLoadError,
        showError,
        navigationStateChange,
        isDarkMode,
        userAgent,
        jsToLoad,
    ])

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

            <PWScrollView
                style={styles.flex}
                contentContainerStyle={styles.flex}
            >
                {renderWebView()}
            </PWScrollView>

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
