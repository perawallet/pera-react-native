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

import { useDeviceInfoService } from '@perawallet/core'
import { config } from '@perawallet/config'
import { useTheme } from '@rneui/themed'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    WebView,
    WebViewMessageEvent,
    WebViewProps,
} from 'react-native-webview'
import {
    WebViewErrorEvent,
    WebViewHttpErrorEvent,
    WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes'
import {
    baseJS,
    peraConnectJS,
    peraMobileInterfaceJS,
} from './injected-scripts'
import useToast from '../../hooks/toast'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { useStyles } from './styles'
import PWView from '../common/view/PWView'
import { usePeraWebviewInterface } from '../../hooks/webview'
import EmptyView from '../common/empty-view/EmptyView'
import PWButton from '../common/button/PWButton'

export type PWWebViewProps = {
    url: string
    enablePeraConnect: boolean
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark') => {
    const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme'
    return `if (updateTheme) { updateTheme('${jsTheme}'); }`
}

const PWWebView = (props: PWWebViewProps) => {
    const styles = useStyles()
    const { url, enablePeraConnect, ...rest } = props
    const { theme } = useTheme()
    const [loaded, setLoaded] = useState(false)
    const webview = useRef<WebView>(null)
    const { showToast } = useToast()
    const mobileInterface = usePeraWebviewInterface(webview.current)

    const deviceInfo = useDeviceInfoService()

    const userAgent = useMemo(() => {
        return `${deviceInfo.getUserAgent()}`
    }, [deviceInfo])

    const reload = () => {
        webview.current?.reload()
    }

    const handleEvent = useCallback(
        (event: WebViewMessageEvent) => {
            if (config.debugEnabled) {
                console.log('Received onMessage event', event.nativeEvent.data)
            }

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

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        console.log('Loading', event.nativeEvent.url)
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
            js += peraConnectJS
        }

        return js
    }, [enablePeraConnect])

    useEffect(() => {
        if (loaded) {
            webview.current?.injectJavaScript(updateTheme(theme.mode))
            if (enablePeraConnect) {
                webview.current?.injectJavaScript(peraMobileInterfaceJS)
            }
        }
    }, [theme, loaded, enablePeraConnect])

    return (
        <PWView style={styles.flex}>
            <WebView
                ref={webview}
                {...rest}
                source={{
                    uri: url,
                }}
                style={styles.webview}
                renderLoading={() => (
                    <PWView style={StyleSheet.absoluteFillObject}>
                        <ActivityIndicator
                            style={styles.loading}
                            color={theme.colors.secondary}
                            size='large'
                            hidesWhenStopped
                        />
                    </PWView>
                )}
                renderError={() => {
                    return (
                        <PWView style={StyleSheet.absoluteFillObject}>
                            <EmptyView
                                title='Failed to load page'
                                body='An error occurred loading this page.  Please 
                                  check your internet connection and try again.'
                                button={
                                    <PWButton
                                        title='Reload'
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
                onLoadStart={verifyLoad}
                onLoadSubResourceError={showLoadError}
                onError={showLoadError}
                onHttpError={showError}
                onLoadEnd={() => setLoaded(true)}
                dataDetectorTypes={[]}
                textInteractionEnabled={false}
            />
        </PWView>
    )
}

export default PWWebView
