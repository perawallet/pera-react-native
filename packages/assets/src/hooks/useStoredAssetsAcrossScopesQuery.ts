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
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { fetchVerificationTiers } from '../chain-adapter'
import { getAssetsByIds } from '../db'
import type { PeraAsset, PeraAssetVerificationTier } from '../models'
import { hashAssetIds, MODULE_PREFIX } from './querykeys'

export type ScopedAssetIds = { scope: ChainScope; assetIds: string[] }

/** Stored assets by scope key, then asset id. */
export type StoredAssetsByScope = ReadonlyMap<
    ChainScopeKey,
    ReadonlyMap<string, PeraAsset>
>

export type UseStoredAssetsAcrossScopesQueryResult = {
    assets: StoredAssetsByScope
    /** Pera's tier for an id the DB lacks, when the backend describes it. */
    unstoredTiers: ReadonlyMap<
        ChainScopeKey,
        ReadonlyMap<string, PeraAssetVerificationTier>
    >
    /**
     * The ids each scope has an answer for. A requested id missing here is
     * still loading, or its tier lookup failed, so its absence from `assets`
     * and `unstoredTiers` says nothing about it.
     */
    readIds: ReadonlyMap<ChainScopeKey, ReadonlySet<string>>
}

const NOTHING_READ: UseStoredAssetsAcrossScopesQueryResult = {
    assets: new Map(),
    unstoredTiers: new Map(),
    readIds: new Map(),
}

const NO_TIERS: ReadonlyMap<string, PeraAssetVerificationTier> = new Map()

/**
 * The local DB's rows for ids spread over several scopes, in one query: a list
 * mixing networks needs them before it renders, where a hook per scope can't
 * be called. `fetchMissingTiers` asks the backend for the tier of each id the
 * DB lacks, without storing it.
 */
export const useStoredAssetsAcrossScopesQuery = (
    groups: readonly ScopedAssetIds[],
    { fetchMissingTiers = false }: { fetchMissingTiers?: boolean } = {},
): UseStoredAssetsAcrossScopesQueryResult => {
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
        queryKey: [
            MODULE_PREFIX,
            'stored-across-scopes',
            keyParts,
            { fetchMissingTiers },
        ],
        enabled: keyParts.length > 0,
        staleTime: Infinity,
        networkMode: 'always',
        // A list that grows page by page changes the key on every page; the
        // last answer keeps the ids it covers settled while the new ones load.
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<UseStoredAssetsAcrossScopesQueryResult> => {
            const entries = await Promise.all(
                groups
                    .filter(group => group.assetIds.length > 0)
                    .map(async group => {
                        const ids = [...new Set(group.assetIds)]
                        const rows = await getAssetsByIds({
                            assetIds: ids,
                            scope: group.scope,
                        })
                        const stored = new Set(rows.map(row => row.assetId))
                        const missing = ids.filter(id => !stored.has(id))
                        let readIds: ReadonlySet<string> = new Set(ids)
                        let tiers = NO_TIERS
                        if (fetchMissingTiers && missing.length > 0) {
                            // ponytail: re-asks every unstored id on each page
                            // and sync; cache answers if that ever grows large.
                            const answer = await fetchVerificationTiers(
                                missing,
                                group.scope,
                            ).catch(error => {
                                logger.warn('Asset tier lookup failed', {
                                    scope: group.scope,
                                    count: missing.length,
                                    error,
                                })
                                return null
                            })
                            if (answer) tiers = answer
                            else readIds = stored
                        }
                        const scopeKey = toScopeKey(group.scope)
                        return {
                            scopeKey,
                            rows: new Map(rows.map(row => [row.assetId, row])),
                            tiers,
                            readIds,
                        }
                    }),
            )
            return {
                assets: new Map(entries.map(e => [e.scopeKey, e.rows])),
                unstoredTiers: new Map(entries.map(e => [e.scopeKey, e.tiers])),
                readIds: new Map(entries.map(e => [e.scopeKey, e.readIds])),
            }
        },
    })
    return data ?? NOTHING_READ
}
