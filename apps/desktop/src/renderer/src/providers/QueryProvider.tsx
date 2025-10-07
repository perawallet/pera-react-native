import React, { PropsWithChildren } from 'react';
import {
  PersistQueryClientProvider,
  PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client';
import { OmitKeyof, QueryCache, QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const cache = new QueryCache({
  onError: error => {
    console.log('An error has occurred:', error);
  },
});
const queryClient = new QueryClient({
  queryCache: cache,
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 30,
      retry: 2,
    },
    mutations: {
      //TODO do we want to enable throwOnError?
      //throwOnError: true
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

type QueryProviderProps = PropsWithChildren;

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { queryClient };
