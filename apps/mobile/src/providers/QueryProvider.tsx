/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React, { PropsWithChildren } from 'react';
import {
  PersistQueryClientProvider,
  PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client';
import { OmitKeyof, QueryCache, QueryClient } from '@tanstack/react-query';

const cache = new QueryCache({
  onError: error => {
    console.log('An error has occurred:', error);
    //TODO should we use a toast here?
  },
});
const queryClient = new QueryClient({
  queryCache: cache,
  defaultOptions: {
    queries: {
      //TODO maybe move this to config?
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

type QueryProviderProps = OmitKeyof<
  PersistQueryClientRootOptions,
  'queryClient'
> &
  PropsWithChildren;

export function QueryProvider({ persister, children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      //TODO make the maxAge configurable?
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { queryClient };
