
import { config, useDeviceInfoService } from '@perawallet/core';
import { useTheme } from '@rneui/themed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { WebViewErrorEvent, WebViewHttpErrorEvent, WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';
import { baseJS, peraConnectJS } from './injected-scripts';
import useToast from '../../hooks/toast';


export type PeraWebViewProps = {
    url: string,
    enablePeraConnect: boolean
} & WebViewProps

const updateTheme = (mode: 'light' | 'dark') => {
    const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme'
    return `if (updateTheme) { updateTheme('${jsTheme}'); }`
}

const PeraWebView = (props: PeraWebViewProps) => {
    const { url, enablePeraConnect, ...rest } = props
    const { theme } = useTheme()
    const [loaded, setLoaded] = useState(false)
    const webview = useRef<WebView>(null)
    const { showToast } = useToast()
   

    const deviceInfo = useDeviceInfoService()

    //TODO: replace this with the real version + platform
    const userAgent = useMemo(() => {
        return `pera_${deviceInfo.getDevicePlatform()}_6.202518.0`
    }, [deviceInfo])

    const handleEvent = useCallback((event: WebViewMessageEvent) => {
        if (config.debugEnabled) {
            console.log('Received onMessage event', event.nativeEvent.data)
        }
    }, [])

    const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
        console.log('Loading', event.nativeEvent.url)
    }, [])

    const showLoadError = useCallback((event: WebViewErrorEvent) => {
        showToast({
            title: event.nativeEvent.title,
            body: `${event.nativeEvent.code} - ${event.nativeEvent.url}`,
            type: 'error'
        })
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
    );
}

export default PeraWebView