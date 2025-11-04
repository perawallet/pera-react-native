import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { QueryProvider } from './providers/QueryProvider';
import { useBootstrapper } from './bootstrap/boostrap';
import { useKeyValueStorageService } from '@perawallet/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Persister } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootComponent } from './components/root/RootComponent';
import BootSplash from 'react-native-bootsplash';
import { NotifierWrapper } from 'react-native-notifier';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();

  const bootstrap = useBootstrapper();
  const kvService = useKeyValueStorageService();

  useEffect(() => {
    if (!bootstrapped) {
      bootstrap().then(() => {
        const reactQueryPersistor = createAsyncStoragePersister({
          storage: kvService,
        });

        setPersister(reactQueryPersistor);
        setBootstrapped(true);

        //we defer the hiding so the initial layout can happen
        setTimeout(() => {
          BootSplash.hide({ fade: true });
        }, 200);
      });
    }
  }, [bootstrapped, bootstrap, kvService]);

  return (
    <SafeAreaProvider>
      {!bootstrapped && <Text>Loading...</Text>}
      {bootstrapped && persister && (
        <GestureHandlerRootView>
            <NotifierWrapper>
              <QueryProvider persister={persister}>
                <RootComponent />
              </QueryProvider>
            </NotifierWrapper>
        </GestureHandlerRootView>
      )}
    </SafeAreaProvider>
  );
}

export default App;
