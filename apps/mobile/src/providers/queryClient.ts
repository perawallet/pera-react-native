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

// The TanStack client singleton, split out of QueryProvider.tsx so it can be
// imported without dragging React, react-native, or the app's `@utils` aliases
// along with it.
//
// The extension's offscreen document (apps/browser/src/offscreen) shares this
// exact instance so both realms hit one cache — but it is headless, and
// pulling the provider component in made apps/browser's tsc program compile a
// react-native file it has no aliases for.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { config } from '@perawallet/wallet-core-config'
import {
    isPeraServiceUnavailableError,
    isTransientNetworkError,
    logger,
    mutationDefaults,
    type PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'

type PeraBackendUnavailableHandler = (
    error: PeraServiceUnavailableError,
) => void

// Set by QueryProvider (a React subtree that can reach the toast layer); this
// module itself stays free of react-native imports so the browser extension's
// offscreen document can share the same QueryClient instance.
let peraBackendUnavailableHandler: PeraBackendUnavailableHandler | undefined

/**
 * Registers the single handler notified whenever a `backend: 'pera'` request
 * raises `PeraServiceUnavailableError` (a Pera request made on BetaNet/custom).
 * Returns a cleanup that unregisters it. Used by `usePeraServiceUnavailableToast`
 * to surface the "not available on this network" toast in one central place.
 */
export const setOnPeraBackendUnavailable = (
    handler: PeraBackendUnavailableHandler,
): (() => void) => {
    peraBackendUnavailableHandler = handler
    return () => {
        if (peraBackendUnavailableHandler === handler) {
            peraBackendUnavailableHandler = undefined
        }
    }
}

const cache = new QueryCache({
    onError: error => {
        // Transient connectivity errors are already logged at warn level by
        // the ky `beforeError` hook (see packages/shared/src/api/query-client).
        // Re-logging them at error level here would double-fire the dev RedBox
        // on every flaky network blip without adding signal.
        if (isTransientNetworkError(error)) {
            return
        }
        // A Pera service that is simply not deployed on the active network
        // (betanet, custom) is an expected condition, not a crash: every
        // ungated Pera query — useCurrenciesQuery mounts on any screen with a
        // fiat value — would otherwise fire a crash-report non-fatal and a
        // dev RedBox on every render. Kept separate from
        // isTransientNetworkError, which means "retrying may succeed" and
        // must keep meaning exactly that.
        if (isPeraServiceUnavailableError(error)) {
            peraBackendUnavailableHandler?.(error)
            return
        }
        logger.error('An error has occurred:', { error })
    },
})

const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
        // Same transient- and not-deployed-skip rationale as the query cache
        // above.
        if (isTransientNetworkError(error)) {
            return
        }
        if (isPeraServiceUnavailableError(error)) {
            peraBackendUnavailableHandler?.(error)
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

export { cache, mutationCache, queryClient }
