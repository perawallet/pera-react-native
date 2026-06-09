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

import type { Network } from '@perawallet/wallet-core-shared'
import { type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { CardTransactionFilters } from '../models'

export const MODULE_PREFIX = 'card'

// Sensitive flows (card details / PIN) deliberately have no query keys — they
// are imperative mutations and must never be cached.
export const cardQueryKeys = {
    all: [MODULE_PREFIX] as const,
    status: (network: Network) =>
        [MODULE_PREFIX, 'status', { network }] as const,
    user: (network: Network) => [MODULE_PREFIX, 'user', { network }] as const,
    registrationSettings: (network: Network) =>
        [MODULE_PREFIX, 'registration-settings', { network }] as const,
    currentRegion: (network: Network) =>
        [MODULE_PREFIX, 'current-region', { network }] as const,
    transactions: (network: Network, filters?: CardTransactionFilters) =>
        [
            MODULE_PREFIX,
            'transactions',
            { network, ...(filters ?? {}) },
        ] as const,
}

export const isCardQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

export const invalidateCardQueries = (queryClient: QueryClient): void => {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}
