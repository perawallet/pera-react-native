import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from './providers/QueryProvider';
import { useBootstrapper, useAppStore } from './bootstrap/boostrap';
import {
  useKeyValueStorageService
} from '@perawallet/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Persister } from '@tanstack/react-query-persist-client';
import { MainRoutes } from './routes/routes';

function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();
  const appState = useAppStore()
  const kvService = useKeyValueStorageService();
  
  const isDarkMode = useMemo(() => {
    return appState.theme === 'dark'
  }, [appState.theme])

  const bootstrap = useBootstrapper()

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
    <SafeAreaProvider>
      {!bootstrapped && <Text>Loading...</Text>}
      {bootstrapped && persister && (
        <QueryProvider persister={persister}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <GestureHandlerRootView style={styles.container}>
            <MainRoutes />
          </GestureHandlerRootView>
        </QueryProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
