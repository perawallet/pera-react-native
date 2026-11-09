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

import { useCallback } from 'react'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getAssetHolderAddresses } from '../db'
import { chainAccountOf } from '../credentials'
import { useAccountsStore } from '../store'
import { getAssetHoldersQueryKey } from './querykeys'

const ASSET_HOLDERS_STALE_TIME_MS = 60_000

export type ResolveAssetHolderAddress = (
    assetId: string,
    scope: ChainScope,
) => Promise<Nullable<string>>

/**
 * Which of the user's accounts to treat as the holder of `assetId` on `scope`,
 * preferring the selected account when it holds the asset. Resolves to the
 * holder's address on that scope's chain, or `null` when no account holds it
 * (including a native asset on a chain that keeps no holdings row for it).
 *
 * The asset and collectible detail screens are account-scoped but their routes
 * only carry an asset id, so they read the *selected* account. Any caller that
 * can surface an asset from a non-selected account — global search does, since
 * it searches every account's holdings — has to point the selection at the real
 * holder first, or the detail screen attributes the asset to whichever account
 * happened to be selected.
 *
 * Reads the accounts as they are when called, so a caller that resolves once
 * per tap (a deep link) holds no subscription.
 */
export const resolveAssetHolderAddress = async (
    queryClient: QueryClient,
    assetId: string,
    scope: ChainScope,
): Promise<Nullable<string>> => {
    const holders = await queryClient.ensureQueryData({
        queryKey: getAssetHoldersQueryKey(assetId, scope),
        queryFn: () => getAssetHolderAddresses({ assetId, scope }),
        staleTime: ASSET_HOLDERS_STALE_TIME_MS,
    })

    const { accounts, getSelectedAccount } = useAccountsStore.getState()
    const selected = getSelectedAccount()
    const selectedAddress = selected
        ? chainAccountOf(selected, scope.chainId)?.address
        : undefined
    // Account removal clears its holdings, but a stale row would otherwise
    // select an address the store no longer knows.
    const known = new Set(
        accounts.flatMap(
            account => chainAccountOf(account, scope.chainId)?.address ?? [],
        ),
    )
    const candidates = holders.filter(address => known.has(address))
    if (candidates.length === 0) return null
    if (selectedAddress && candidates.includes(selectedAddress)) {
        return selectedAddress
    }
    return candidates[0] ?? null
}

/** `resolveAssetHolderAddress` bound to the query client. */
export const useResolveAssetHolderAddress = (): ResolveAssetHolderAddress => {
    const queryClient = useQueryClient()
    return useCallback(
        (assetId: string, scope: ChainScope) =>
            resolveAssetHolderAddress(queryClient, assetId, scope),
        [queryClient],
    )
}
