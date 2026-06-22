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

import React, { type PropsWithChildren } from 'react'
import {
    PersistQueryClientProvider,
    type PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client'
import { type OmitKeyof, QueryCache, QueryClient } from '@tanstack/react-query'
import { config } from '@perawallet/wallet-core-config'
import { isTransientNetworkError, logger } from '@perawallet/wallet-core-shared'
import { isAccountQuery } from '@perawallet/wallet-core-accounts'
import { isAssetQuery } from '@perawallet/wallet-core-assets'
import { isTransactionQuery } from '@perawallet/wallet-core-transactions'
import { isCardQuery } from '@perawallet/wallet-core-card'

const cache = new QueryCache({
    onError: error => {
        // Transient connectivity errors are already logged at warn level by
        // the ky `beforeError` hook (see packages/shared/src/api/query-client).
        // Re-logging them at error level here would double-fire the dev RedBox
        // on every flaky network blip without adding signal.
        if (isTransientNetworkError(error)) {
            return
        }
        logger.error('An error has occurred:', { error })
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
                dehydrateOptions: {
                    shouldDehydrateQuery: query => {
                        // Don't persist DB-backed queries — SQLite is the source of truth.
                        // Card queries are excluded too: their responses can carry KYC
                        // PII that must never land in the unencrypted disk cache.
                        if (
                            isAccountQuery(query.queryKey) ||
                            isAssetQuery(query.queryKey) ||
                            isTransactionQuery(query.queryKey) ||
                            isCardQuery(query.queryKey)
                        ) {
                            return false
                        }
                        return query.state.status === 'success'
                    },
                },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}

export { queryClient }
