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

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getAssetHolderAddresses } from '../db'
import { useAllAccounts } from './useAllAccounts'
import { useSelectedAccountAddress } from './useSelectedAccountAddress'
import { getAssetHoldersQueryKey } from './querykeys'

const ASSET_HOLDERS_STALE_TIME_MS = 60_000

export type ResolveAssetHolderAddress = (
    assetId: string,
) => Promise<Nullable<string>>

/**
 * Which of the user's accounts to treat as the holder of `assetId`, preferring
 * the selected account when it holds the asset. Resolves to `null` when no
 * account holds it (including ALGO, which has no holdings row).
 *
 * The asset and collectible detail screens are account-scoped but their routes
 * only carry an asset id, so they read the *selected* account. Any caller that
 * can surface an asset from a non-selected account — global search does, since
 * it searches every account's holdings — has to point the selection at the real
 * holder first, or the detail screen attributes the asset to whichever account
 * happened to be selected.
 */
export const useResolveAssetHolderAddress = (): ResolveAssetHolderAddress => {
    const { network } = useNetwork()
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const accounts = useAllAccounts()
    const queryClient = useQueryClient()

    const knownAddresses = useMemo(
        () => new Set(accounts.map(account => account.address)),
        [accounts],
    )

    return useCallback(
        async (assetId: string) => {
            const holders = await queryClient.ensureQueryData({
                queryKey: getAssetHoldersQueryKey(assetId, network),
                queryFn: () => getAssetHolderAddresses({ assetId, network }),
                staleTime: ASSET_HOLDERS_STALE_TIME_MS,
            })

            // Account removal clears its holdings, but a stale row would
            // otherwise select an address the store no longer knows.
            const candidates = holders.filter(address =>
                knownAddresses.has(address),
            )
            if (candidates.length === 0) return null
            if (
                selectedAccountAddress &&
                candidates.includes(selectedAccountAddress)
            ) {
                return selectedAccountAddress
            }
            return candidates[0] ?? null
        },
        [queryClient, network, knownAddresses, selectedAccountAddress],
    )
}
