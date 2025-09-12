import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from './providers/QueryProvider';
import DemoScreen from './screens/DemoScreen';
import { bootstrapApp, useAppStore } from './bootstrap/boostrap';
import { KeyValueStorageService, KeyValueStorageServiceContainerKey } from '@perawallet/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Persister } from '@tanstack/react-query-persist-client';
import { container } from 'tsyringe';
import PortfolioScreen from './screens/portfolio/PortfolioScreen';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrapApp()
        .then(() => {
          const kvService = container.resolve<KeyValueStorageService>(KeyValueStorageServiceContainerKey)
          const reactQueryPersistor = createAsyncStoragePersister({
            storage: kvService,
          });
          setPersister(reactQueryPersistor);
          setBootstrapped(true);
          setIsDarkMode(useAppStore.getState().theme == 'dark')
        })
    }
  }, [bootstrapped]);

  return (
    <SafeAreaProvider>
      {!bootstrapped && <Text>Loading...</Text>}
      {bootstrapped && persister && (
        <QueryProvider persister={persister}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <GestureHandlerRootView style={styles.container}>
            <PortfolioScreen />
          </GestureHandlerRootView>
        </QueryProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});

export default App;
