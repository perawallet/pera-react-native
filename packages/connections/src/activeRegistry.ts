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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { ConnectionRegistryClient } from './registry'

let activeRegistry: Nullable<ConnectionRegistryClient> = null

/**
 * For the duress wipe, which runs above the provider: without a registry to
 * sweep with it clears the records but never says goodbye, leaving every socket
 * alive until restart. A module `let`, not a store: nothing renders off it.
 */
export const setActiveConnectionRegistry = (
    registry: Nullable<ConnectionRegistryClient>,
): void => {
    activeRegistry = registry
}

export const getActiveConnectionRegistry =
    (): Nullable<ConnectionRegistryClient> => activeRegistry
