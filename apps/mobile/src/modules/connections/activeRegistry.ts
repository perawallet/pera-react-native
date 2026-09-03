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

import type { ConnectionRegistry } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'

let activeRegistry: Nullable<ConnectionRegistry> = null

/**
 * Publishes the registry `ConnectionsProvider` owns, for the one caller that
 * cannot reach it through context: `useDeleteAllData` also runs from
 * `AutoLockGuard`'s duress wipe, which `RootComponent` mounts ABOVE the
 * provider. Without it the wipe clears the records but never says goodbye,
 * leaving every v1 socket and session key alive until the app restarts.
 *
 * Deliberately a module `let` rather than a store: nothing renders off it,
 * and a second source of registry truth is exactly what the context already
 * is. Every consumer that CAN see the context must keep using
 * `useConnectionRegistry`.
 */
export const setActiveConnectionRegistry = (
    registry: Nullable<ConnectionRegistry>,
): void => {
    activeRegistry = registry
}

export const getActiveConnectionRegistry = (): Nullable<ConnectionRegistry> =>
    activeRegistry
