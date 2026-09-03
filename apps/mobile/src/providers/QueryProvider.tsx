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
import { type OmitKeyof, focusManager } from '@tanstack/react-query'
import { config } from '@perawallet/wallet-core-config'
import { isActiveAppState } from '@utils/app-state'
import { shouldDehydrateQuery } from './query-persistence'
import { queryClient } from './queryClient'
import { usePeraServiceUnavailableToast } from '@hooks/usePeraServiceUnavailableToast'

export type QueryProviderProps = OmitKeyof<
    PersistQueryClientRootOptions,
    'queryClient'
> &
    PropsWithChildren

// Mounted as a `null` host (not called from the provider body) so the toast
// hook's UI subscriptions — safe-area insets via useToast, i18n via
// useLanguage — re-render this leaf, never QueryProvider itself, whose
// `persistOptions` would otherwise be re-allocated on every render.
const PeraServiceUnavailableToast = (): null => {
    usePeraServiceUnavailableToast()
    return null
}

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
            <PeraServiceUnavailableToast />
            {children}
        </PersistQueryClientProvider>
    )
}

export { queryClient }
