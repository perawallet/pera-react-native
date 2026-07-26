/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React, { useEffect, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import {
    PersistQueryClientProvider,
    type PersistQueryClientRootOptions,
} from '@tanstack/react-query-persist-client'
import {
    type OmitKeyof,
    MutationCache,
    QueryCache,
    QueryClient,
    focusManager,
} from '@tanstack/react-query'
import { config } from '@perawallet/wallet-core-config'
import {
    isTransientNetworkError,
    logger,
    mutationDefaults,
} from '@perawallet/wallet-core-shared'
import { isActiveAppState } from '@utils/app-state'
import { shouldDehydrateQuery } from './query-persistence'

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

const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
        // Same transient-skip rationale as the query cache above.
        if (isTransientNetworkError(error)) {
            return
        }
        logger.error('Mutation failed:', {
            error,
            mutationKey: mutation.options.mutationKey,
        })
    },
})

const queryClient = new QueryClient({
    queryCache: cache,
    mutationCache,
    defaultOptions: {
        queries: {
            gcTime: config.reactQueryDefaultGCTime,
            staleTime: config.reactQueryDefaultStaleTime,
            retry: 0, //ky handles retries
            // Focus is wired below solely to pause interval polls in the
            // background. Without this pin, wiring focus would also switch on
            // the library default refetchOnWindowFocus for every mounted stale
            // query, bursting requests on each foreground. Opt in per-query.
            refetchOnWindowFocus: false,
        },
        // OFF-004: mutation policy (networkMode 'always' → fail fast offline,
        // never pause/auto-resume; throwOnError false → surface as
        // `mutation.error`, not render-phase throw). `mutationDefaults` in
        // `@perawallet/wallet-core-shared` is the single source of truth so
        // package-level tests exercise the identical config. Failures are logged
        // centrally by `mutationCache.onError`; user-facing surfacing stays at
        // the call site.
        mutations: mutationDefaults,
    },
})

export type QueryProviderProps = OmitKeyof<
    PersistQueryClientRootOptions,
    'queryClient'
> &
    PropsWithChildren

export function QueryProvider({ persister, children }: QueryProviderProps) {
    // Drive React Query's focusManager from AppState: on React Native the
    // manager has no default signal, so interval polls keep firing while the
    // app is backgrounded (refetchIntervalInBackground defaults to false, but
    // it only takes effect once focus is wired).
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            focusManager.setFocused(isActiveAppState(state))
        })
        return () => subscription.remove()
    }, [])

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: config.reactQueryPersistenceAge,
                dehydrateOptions: { shouldDehydrateQuery },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}

export { queryClient }
