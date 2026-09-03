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

import { createContext, useContext } from 'react'
import type { ConnectionRegistry } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The context alone, split out from `ConnectionsProvider` so a consumer that
 * only reads the registry can avoid dragging the provider's whole boot
 * sequence (the v1 handler, the migration, the approval sheets) into its
 * module graph.
 *
 * Importing this module directly is what earns that; the `@modules/connections`
 * barrel also exports `ConnectionsProvider`, so a barrel import pulls the boot
 * sequence in regardless. `useDeleteAllData` does exactly that today.
 */
export const ConnectionRegistryContext =
    createContext<Nullable<ConnectionRegistry>>(null)

/**
 * The single connection registry `ConnectionsProvider` owns the lifetime of.
 * Throws outside a provider rather than returning `null`: every consumer is
 * a descendant of `RootComponent`, so a missing context means a wiring
 * mistake, not a legitimate "no registry yet" state.
 */
export const useConnectionRegistry = (): ConnectionRegistry => {
    const registry = useContext(ConnectionRegistryContext)
    if (!registry) {
        throw new Error(
            'useConnectionRegistry must be used within ConnectionsProvider',
        )
    }
    return registry
}

/**
 * Non-throwing counterpart to `useConnectionRegistry`, for the rare consumer
 * that must run correctly whether or not `ConnectionsProvider` happens to be
 * mounted above it: `useDeleteAllData` is called both from Settings (a
 * descendant) and from `AutoLockGuard`'s duress wipe, which `RootComponent`
 * mounts ABOVE this provider — and from the browser extension, which mounts
 * no provider at all. Every other consumer should keep using
 * `useConnectionRegistry`: its throw is deliberate, catching a real wiring
 * mistake rather than a legitimate "no registry yet" state.
 */
export const useOptionalConnectionRegistry = (): Nullable<ConnectionRegistry> =>
    useContext(ConnectionRegistryContext)
