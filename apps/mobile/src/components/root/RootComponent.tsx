import { config, useAppStore, useDevice, usePolling } from '@perawallet/core';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, StatusBar, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MainRoutes } from '../../routes/routes';
import { getNavigationTheme, getTheme } from '../../theme/theme';
import { ThemeProvider } from '@rneui/themed';
import { useStyles } from './styles';
import PeraView from '../../components/common/view/PeraView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from 'react-native-error-boundary';
import useToast from '../../hooks/toast';
import { useIsDarkMode } from '../../hooks/theme';

const RootContentContainer = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const insets = useSafeAreaInsets();
  const styles = useStyles(insets);
  const network = useAppStore(state => state.network);
  const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light');
  const { showToast } = useToast()

  const networkBarStyle = useMemo(() => {
    if (network === 'testnet') {
      return styles.testnetBar;
    }
    return styles.mainnetBar;
  }, [network, styles.testnetBar, styles.mainnetBar]);

  const showError = (error: any) => {
    showToast({
      title: 'Error',
      body: config.debugEnabled ? `Details: ${error}` : "An error has occured, please try again.",
      type: 'error'
    })
  }

  return (
    <ErrorBoundary onError={showError}>
      <PeraView style={styles.container}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={networkBarStyle} />
        <GestureHandlerRootView>
          <MainRoutes theme={navTheme} />
        </GestureHandlerRootView>
      </PeraView>
    </ErrorBoundary>
  );
};

export const RootComponent = () => {
  const isDarkMode = useIsDarkMode()

  const theme = getTheme(isDarkMode ? 'dark' : 'light');
  const { registerDevice } = useDevice();
  const { startPolling, stopPolling } = usePolling();

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    //TODO: this doesn't handle switching networks
    registerDevice();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        startPolling();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        stopPolling();
      }

      appState.current = nextAppState;
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (

    <ThemeProvider theme={theme}>
      <RootContentContainer isDarkMode={isDarkMode} />
    </ThemeProvider>
  );
};
