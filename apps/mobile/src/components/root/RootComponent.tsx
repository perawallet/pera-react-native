import { useAppStore, useDevice, usePolling } from '@perawallet/core';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MainRoutes } from '../../routes/routes';
import { getNavigationTheme, getTheme } from '../../theme/theme';
import { ThemeProvider } from '@rneui/themed';

export const RootComponent = () => {
  const themeMode = useAppStore(state => state.theme);
  const scheme = useColorScheme();
  const isDarkMode = useMemo(() => {
    return (
      themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark')
    );
  }, [themeMode, scheme]);

  const theme = getTheme(isDarkMode ? 'dark' : 'light');
  const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light');
  const { registerDevice } = useDevice();
  const { startPolling, stopPolling } = usePolling();

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    registerDevice();

    startPolling();
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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <GestureHandlerRootView>
        <MainRoutes theme={navTheme} />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
};
