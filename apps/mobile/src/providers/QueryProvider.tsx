import React, { PropsWithChildren } from 'react';
import {
  PersistQueryClientProvider,
  PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client';
import { OmitKeyof, QueryClient } from '@tanstack/react-query';

//TODO: we'll want to inject headers here too probably
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 30,
      retry: 2,
    },
  },
});

type QueryProviderProps = OmitKeyof<
  PersistQueryClientRootOptions,
  'queryClient'
> &
  PropsWithChildren;

export function QueryProvider({ persister, children }: QueryProviderProps) {
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
