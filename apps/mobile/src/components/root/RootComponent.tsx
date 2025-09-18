import { useAppStore, useDevice } from '@perawallet/core';
import { useEffect, useMemo } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
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

  useEffect(() => {
    registerDevice();
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
