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

import { useQuery } from '@tanstack/react-query'
import { getAssetsByIds, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getAccountCollectiblesLite, getAccountHoldingsLite } from '../db'
import { getHeldAssetDetailsQueryKey } from './querykeys'

export type HeldAssetKind = 'fungible' | 'collectible'

export type UseHeldAssetDetailsQueryOptions = {
    kind: HeldAssetKind
    /** Caps how many held ids are looked up, in holdings order. */
    maxAssetIds?: number
    enabled?: boolean
}

export type UseHeldAssetDetailsQueryResult = {
    /** `undefined` while loading or disabled. */
    assets: Optional<PeraAsset[]>
    isError: boolean
}

const readHeldAssetIds = async (
    address: string,
    scope: ChainScope,
    kind: HeldAssetKind,
): Promise<string[]> => {
    const sources = [{ address, scope }]
    const rows =
        kind === 'fungible'
            ? await getAccountHoldingsLite({
                  sources,
                  hideZeroBalance: true,
                  hideNfts: true,
              })
            : await getAccountCollectiblesLite({
                  sources,
                  includeZeroBalance: false,
              })
    return rows.map(row => row.assetId)
}

/** Asset records for what `addresses` hold with a non-zero balance on `scope`. */
export const useHeldAssetDetailsQuery = (
    addresses: readonly string[],
    scope: ChainScope,
    { kind, maxAssetIds, enabled = true }: UseHeldAssetDetailsQueryOptions,
): UseHeldAssetDetailsQueryResult => {
    const sortedAddresses = [...addresses].sort()
    const { data, isError } = useQuery({
        queryKey: getHeldAssetDetailsQueryKey(sortedAddresses, scope, {
            kind,
            maxAssetIds,
        }),
        enabled: enabled && sortedAddresses.length > 0,
        // Local SQLite reads; must not pause offline.
        networkMode: 'always',
        queryFn: async () => {
            const idLists = await Promise.all(
                sortedAddresses.map(address =>
                    readHeldAssetIds(address, scope, kind),
                ),
            )
            const assetIds = [...new Set(idLists.flat())].slice(0, maxAssetIds)
            return getAssetsByIds({ assetIds, scope })
        },
    })
    return { assets: data, isError }
}
