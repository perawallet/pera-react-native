import { useDeviceInfoService } from '@perawallet/core'
import { config } from '@perawallet/config'
import { useTheme } from '@rneui/themed'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WebView,
  WebViewMessageEvent,
  WebViewProps,
} from 'react-native-webview';
import {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {
  baseJS,
  peraConnectJS,
  peraMobileInterfaceJS,
} from './injected-scripts';
import useToast from '../../../hooks/toast';
import { ActivityIndicator } from 'react-native';
import { useStyles } from './styles';
import PeraView from '../view/PeraView';
import { usePeraWebviewInterface } from '../../../hooks/webview';

export type PeraWebViewProps = {
  url: string;
  enablePeraConnect: boolean;
} & WebViewProps;

const updateTheme = (mode: 'light' | 'dark') => {
  const jsTheme = mode === 'dark' ? 'dark-theme' : 'light-theme';
  return `if (updateTheme) { updateTheme('${jsTheme}'); }`;
};

const PeraWebView = (props: PeraWebViewProps) => {
  const styles = useStyles()
  const { url, enablePeraConnect, ...rest } = props;
  const { theme } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const webview = useRef<WebView>(null);
  const { showToast } = useToast();
  const mobileInterface = usePeraWebviewInterface(webview.current)

  const deviceInfo = useDeviceInfoService();

  const userAgent = useMemo(() => {
    return `${deviceInfo.getUserAgent()}`;
  }, [deviceInfo]);

  const handleEvent = useCallback(
    (event: WebViewMessageEvent) => {
      if (config.debugEnabled) {
        console.log('Received onMessage event', event.nativeEvent.data);
      }

      const dataString = event.nativeEvent.data
      if (!dataString) {
        showToast({
          title: 'Invalid message received',
          body: `Pera Wallet mobile interface received an invalid event`,
          type: 'error',
        });
      }

      const data = JSON.parse(dataString)
      mobileInterface.handleMessage(data)
    },
    [showToast],
  );

  const verifyLoad = useCallback((event: WebViewNavigationEvent) => {
    console.log('Loading', event.nativeEvent.url);
  }, []);

  const showLoadError = useCallback(
    (event: WebViewErrorEvent) => {
      showToast({
        title: event.nativeEvent.title,
        body: `${event.nativeEvent.code} - ${event.nativeEvent.url}`,
        type: 'error',
      });
    },
    [showToast],
  );

  const showError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      showToast({
        title: event.nativeEvent.title,
        body: `${event.nativeEvent.statusCode} - ${event.nativeEvent.description}`,
        type: 'error',
      });
    },
    [showToast],
  );

  const jsToLoad = useMemo(() => {
    let js = baseJS;

    if (enablePeraConnect) {
      js += peraConnectJS;
    }

    return js;
  }, [enablePeraConnect]);

  useEffect(() => {
    if (loaded) {
      webview.current?.injectJavaScript(updateTheme(theme.mode));
      if (enablePeraConnect) {
        webview.current?.injectJavaScript(peraMobileInterfaceJS);
      }
    }
  }, [theme, loaded, enablePeraConnect]);

  return (
    <PeraView style={{flex: 1}}>
    <WebView
      ref={webview}
      {...rest}
      source={{
        uri: url,
      }}
      style={styles.webview}
      renderLoading={() => <ActivityIndicator style={styles.loading} color={theme.colors.secondary} size='large' hidesWhenStopped />}
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
    </PeraView>
  );
};

export default PeraWebView;
