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

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { getAssetsByIds } from '../db'
import type { PeraAsset } from '../models'
import { hashAssetIds, MODULE_PREFIX } from './querykeys'

export type ScopedAssetIds = { scope: ChainScope; assetIds: string[] }

/** Stored assets by scope key, then asset id. */
export type StoredAssetsByScope = ReadonlyMap<
    ChainScopeKey,
    ReadonlyMap<string, PeraAsset>
>

const NO_ASSETS: StoredAssetsByScope = new Map()

/**
 * The local DB's rows for ids spread over several scopes, in one query: a list
 * mixing networks needs them before it renders, where a hook per scope can't
 * be called. DB only, like `useAssetsQuery` without `fetchMissing`.
 */
export const useStoredAssetsAcrossScopesQuery = (
    groups: readonly ScopedAssetIds[],
): StoredAssetsByScope => {
    const keyParts = useMemo(
        () =>
            groups
                .filter(group => group.assetIds.length > 0)
                .map(group => ({
                    scopeKey: toScopeKey(group.scope),
                    ids: hashAssetIds([...new Set(group.assetIds)].sort()),
                }))
                .sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
        [groups],
    )
    const { data } = useQuery({
        queryKey: [MODULE_PREFIX, 'stored-across-scopes', keyParts],
        enabled: keyParts.length > 0,
        staleTime: Infinity,
        networkMode: 'always',
        queryFn: async () => {
            const entries = await Promise.all(
                groups
                    .filter(group => group.assetIds.length > 0)
                    .map(async group => {
                        const rows = await getAssetsByIds({
                            assetIds: [...new Set(group.assetIds)],
                            scope: group.scope,
                        })
                        return [
                            toScopeKey(group.scope),
                            new Map(rows.map(row => [row.assetId, row])),
                        ] as const
                    }),
            )
            return new Map(entries) as StoredAssetsByScope
        },
    })
    return data ?? NO_ASSETS
}
