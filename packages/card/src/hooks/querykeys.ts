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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { CardTransactionFilters, CardWalletKind } from '../models'

export const MODULE_PREFIX = 'card'

// Sensitive flows (card details / PIN) deliberately have no query keys — they
// are imperative mutations and must never be cached.
export const cardQueryKeys = {
    all: [MODULE_PREFIX] as const,
    status: (scope: ChainScope) =>
        [MODULE_PREFIX, 'status', { scope }] as const,
    user: (scope: ChainScope) => [MODULE_PREFIX, 'user', { scope }] as const,
    onboardingDetails: (scope: ChainScope, onboardingId: Nullable<string>) =>
        [MODULE_PREFIX, 'onboarding-details', { scope, onboardingId }] as const,
    registrationSettings: (scope: ChainScope) =>
        [MODULE_PREFIX, 'registration-settings', { scope }] as const,
    currentRegion: (scope: ChainScope) =>
        [MODULE_PREFIX, 'current-region', { scope }] as const,
    transactions: (scope: ChainScope, filters?: CardTransactionFilters) =>
        [MODULE_PREFIX, 'transactions', { scope, ...(filters ?? {}) }] as const,
    pendingWithdrawal: (scope: ChainScope, ownerAddress: Nullable<string>) =>
        [MODULE_PREFIX, 'pending-withdrawal', { scope, ownerAddress }] as const,
    usdcBalance: (scope: ChainScope, address: string) =>
        [MODULE_PREFIX, 'usdc-balance', { scope, address }] as const,
    // bigints are stringified: React Query hashes keys with JSON.stringify.
    // The deadline makes every wait its own query.
    usdcCredit: (
        scope: ChainScope,
        watch: {
            address: string
            before: bigint
            minimum: bigint
            deadline: number
        },
    ) =>
        [
            MODULE_PREFIX,
            'usdc-credit',
            {
                scope,
                address: watch.address,
                before: watch.before.toString(),
                minimum: watch.minimum.toString(),
                deadline: watch.deadline,
            },
        ] as const,
    walletBalance: (scope: ChainScope, kind: CardWalletKind) =>
        [MODULE_PREFIX, 'wallet-balance', { scope, kind }] as const,
    walletHistory: (
        scope: ChainScope,
        kind: CardWalletKind,
        walletId: string,
    ) => [MODULE_PREFIX, 'wallet-history', { scope, kind, walletId }] as const,
    // Prefix of `walletHistory` for invalidating every page of one wallet kind.
    walletHistoryByKind: (scope: ChainScope, kind: CardWalletKind) =>
        [MODULE_PREFIX, 'wallet-history', { scope, kind }] as const,
    externalWallets: (scope: ChainScope) =>
        [MODULE_PREFIX, 'external-wallets', { scope }] as const,
    // OS-wallet push provisioning state is device-local, so these two are
    // deliberately not keyed by scope.
    walletProvisioningAvailability: [
        MODULE_PREFIX,
        'wallet-provisioning',
        'availability',
    ] as const,
    walletProvisioningStatus: (panLast4: Nullable<string>) =>
        [MODULE_PREFIX, 'wallet-provisioning', 'status', { panLast4 }] as const,
}

// Stable mutation keys so the same logical operation is recognised as a single
// in-flight mutation across independent useMutation callers (e.g. the Card
// Frozen banner and the Card Details options row both unfreezing).
export const cardMutationKeys = {
    freeze: [MODULE_PREFIX, 'freeze'] as const,
    unfreeze: [MODULE_PREFIX, 'unfreeze'] as const,
    order: [MODULE_PREFIX, 'order'] as const,
}

export const isCardQuery = (queryKey: QueryKey): boolean =>
    queryKey[0] === MODULE_PREFIX

export const invalidateCardQueries = (queryClient: QueryClient): void => {
    void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === MODULE_PREFIX,
    })
}
