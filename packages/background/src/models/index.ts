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

import type { QueryClient } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'

/**
 * Handler invoked after a submitted transaction group involves wallet-held
 * addresses. Structurally compatible with `OnConfirmedHandler` from
 * `@perawallet/wallet-core-signing`; duplicated here to keep the
 * dependency edge `signing → background` (not the reverse).
 */
export type SyncCompletionHandler = (
    addresses: string[],
    network: Network,
) => void | Promise<void>

export type SyncServiceDeps = {
    queryClient: QueryClient
    /**
     * Optional registration function for the post-confirmation refresh
     * hook. When provided, `initializeSyncService` wires the freshly-built
     * SyncService instance into the registry so `submitAndAutoRefresh`
     * (in @perawallet/wallet-core-signing) can call back without the
     * background package depending on signing.
     */
    registerCompletionHandler?: (handler: SyncCompletionHandler) => void
    /**
     * Base poll cadence in ms (default 3000). The offscreen document uses a
     * slow cadence (warm polling) so it never competes with a focused UI
     * context's 3s loop for API budget.
     */
    pollIntervalMs?: number
}
