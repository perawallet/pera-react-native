/**
 * Mobile App shell wired to shared core/services
 * @format
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from '~/providers/QueryProvider';
import DemoScreen from '~/screens/DemoScreen';
import { bootstrapApp } from '~/bootstrap/boostrap';
import { useKeyValueStorageService } from '@perawallet/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Persister } from '@tanstack/react-query-persist-client';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();
  const kvService = useKeyValueStorageService();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrapApp();

      const reactQueryPersistor = createAsyncStoragePersister({
        storage: kvService,
      });
      setPersister(reactQueryPersistor);
      setBootstrapped(true);
    }
  }, [kvService, bootstrapped]);

  return (
    <SafeAreaProvider>
      {!bootstrapped && <View>Loading...</View>}
      {bootstrapped && persister && (
        <QueryProvider persister={persister}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <GestureHandlerRootView style={styles.container}>
            <DemoScreen />
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
