import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, Text, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryProvider } from './providers/QueryProvider';
import { useBootstrapper } from './bootstrap/boostrap';
import { useAppStore, useKeyValueStorageService } from '@perawallet/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Persister } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from '@rneui/themed';
import { getNavigationTheme, getTheme } from './theme/theme';
import { MainRoutes } from './routes/routes';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();
  const themeMode = useAppStore(state => state.theme);
  const kvService = useKeyValueStorageService();

  const scheme = useColorScheme();
  const isDarkMode = useMemo(() => {
    return (
      themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark')
    );
  }, [themeMode, scheme]);

  const theme = getTheme(isDarkMode ? 'dark' : 'light');
  const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light');

  const bootstrap = useBootstrapper();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrap().then(() => {
        const reactQueryPersistor = createAsyncStoragePersister({
          storage: kvService,
        });
        setPersister(reactQueryPersistor);
        setBootstrapped(true);
      });
    }
  }, [bootstrapped, bootstrap, kvService]);

  return (
    <ThemeProvider theme={theme}>
      <SafeAreaProvider>
        {!bootstrapped && <Text>Loading...</Text>}
        {bootstrapped && persister && (
          <QueryProvider persister={persister}>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            />
            <GestureHandlerRootView>
              <MainRoutes theme={navTheme} />
            </GestureHandlerRootView>
          </QueryProvider>
        )}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;
