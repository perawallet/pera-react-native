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

import React, { PropsWithChildren } from 'react'
import {
    PersistQueryClientProvider,
    PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client'
import { OmitKeyof, QueryCache, QueryClient } from '@tanstack/react-query'
import { config } from '@perawallet/wallet-core-config'
import { ApiError, logger } from '@perawallet/wallet-core-shared'

const cache = new QueryCache({
    onError: error => {
        logger.error('An error has occurred:', { error })
        //TODO should we throw here?
    },
})

const queryClient = new QueryClient({
    queryCache: cache,
    defaultOptions: {
        queries: {
            gcTime: config.reactQueryDefaultGCTime,
            staleTime: config.reactQueryDefaultStaleTime,
            retry: 0, //ky handles retries
        },
        mutations: {
            throwOnError: true,
        },
    },
})

export type QueryProviderProps = OmitKeyof<
    PersistQueryClientRootOptions,
    'queryClient'
> &
    PropsWithChildren

export function QueryProvider({ persister, children }: QueryProviderProps) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: config.reactQueryPersistenceAge,
            }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}

export { queryClient }
