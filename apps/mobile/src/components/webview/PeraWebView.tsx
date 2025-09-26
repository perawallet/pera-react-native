
import { config, useDeviceInfoService } from '@perawallet/core';
import { useTheme } from '@rneui/themed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { WebViewHttpErrorEvent, WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';
import { baseJS, peraConnectJS } from './injected-scripts';
import useToast from '../../hooks/toast';


export type PeraWebViewProps = {
    url: string,
    enablePeraConnect: boolean
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark') => {
    const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme'
    return `updateTheme(${jsTheme}); alert('Set theme to ${jsTheme}')`
}

const PeraWebView = (props: PeraWebViewProps) => {
    const { url, enablePeraConnect, ...rest } = props
    const { theme } = useTheme()
    const [loaded, setLoaded] = useState(false)
    const webview = useRef<WebView>(null)
    const { showToast } = useToast()
   

    const deviceInfo = useDeviceInfoService()

    const handleEvent = useCallback((event: WebViewMessageEvent) => {
        showToast({
            title: event.nativeEvent.title || "WebView Event",
            body: event.nativeEvent?.data || "",
            type: 'info'
        });
    }, [])

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        if (event.nativeEvent.url.endsWith('.js')) {
            showToast({
                title: event.nativeEvent.title || "Loading JS",
                body: event.nativeEvent?.url || "",
                type: 'info'
            });
        }
    }, [])

    const showError = useCallback((event: WebViewHttpErrorEvent) => {
        showToast({
            title: event.nativeEvent.title,
            body: `${event.nativeEvent.statusCode} - ${event.nativeEvent.description}`,
            type: 'error'
        })
    }, []) 

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
        }
    }, [theme, loaded])

    return (
      <WebView
        ref={webview}
        {...rest}
        source={{ 
            uri: url
        }}
        onMessage={handleEvent}
        webviewDebuggingEnabled={config.debugEnabled}
        injectedJavaScript={jsToLoad}
        forceDarkOn={theme.mode === 'dark'}
        setSupportMultipleWindows={false}
        userAgent={deviceInfo.getUserAgent()}
        onLoadStart={verifyLoad}
        onHttpError={showError}
        onLoadEnd={() => setLoaded(true)}
        onError={(error) => console.log(error)}
      />
    );
}

export default PeraWebView