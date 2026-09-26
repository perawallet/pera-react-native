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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { CardTransactionFilters, CardWalletKind } from '../models'

export const MODULE_PREFIX = 'card'

// Sensitive flows (card details / PIN) deliberately have no query keys — they
// are imperative mutations and must never be cached.
export const cardQueryKeys = {
    all: [MODULE_PREFIX] as const,
    status: (network: Network) =>
        [MODULE_PREFIX, 'status', { network }] as const,
    user: (network: Network) => [MODULE_PREFIX, 'user', { network }] as const,
    onboardingDetails: (network: Network, onboardingId: Nullable<string>) =>
        [
            MODULE_PREFIX,
            'onboarding-details',
            { network, onboardingId },
        ] as const,
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
    pendingWithdrawal: (network: Network, ownerAddress: Nullable<string>) =>
        [
            MODULE_PREFIX,
            'pending-withdrawal',
            { network, ownerAddress },
        ] as const,
    usdcBalance: (network: Network, address: string) =>
        [MODULE_PREFIX, 'usdc-balance', { network, address }] as const,
    // bigints are stringified: React Query hashes keys with JSON.stringify.
    // The deadline makes every wait its own query.
    usdcCredit: (
        network: Network,
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
                network,
                address: watch.address,
                before: watch.before.toString(),
                minimum: watch.minimum.toString(),
                deadline: watch.deadline,
            },
        ] as const,
    walletBalance: (network: Network, kind: CardWalletKind) =>
        [MODULE_PREFIX, 'wallet-balance', { network, kind }] as const,
    walletHistory: (network: Network, kind: CardWalletKind, walletId: string) =>
        [MODULE_PREFIX, 'wallet-history', { network, kind, walletId }] as const,
    // Prefix of `walletHistory` for invalidating every page of one wallet kind.
    walletHistoryByKind: (network: Network, kind: CardWalletKind) =>
        [MODULE_PREFIX, 'wallet-history', { network, kind }] as const,
    externalWallets: (network: Network) =>
        [MODULE_PREFIX, 'external-wallets', { network }] as const,
    // OS-wallet push provisioning state is device-local, so these two are
    // deliberately not keyed by network.
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
