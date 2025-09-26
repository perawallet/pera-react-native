
import { config, useDeviceInfoService } from '@perawallet/core';
import { useTheme } from '@rneui/themed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';
import { baseJS, peraConnectJS } from './injected-scripts';

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
   

    const deviceInfo = useDeviceInfoService()

    const handleEvent = useCallback((event: WebViewMessageEvent) => {
        Alert.alert("Received JS event: " + event.nativeEvent?.title)
    }, [])

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        if (event.nativeEvent.url.endsWith('.js')) {
            Alert.alert("Loading JS doc: " + event.nativeEvent?.title)
        }
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
        onLoadEnd={() => setLoaded(true)}
        onError={(error) => console.log(error)}
      />
    );
}

export default PeraWebView