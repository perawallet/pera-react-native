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
import {
    isChainRefusedError,
    isPeraServiceUnavailableError,
    logger,
} from '@perawallet/wallet-core-shared'
import { fetchAssetVerdicts, type AssetVerdict } from '../chain-adapter'
import { getAssetsByIds } from '../db'
import type { PeraAsset } from '../models'
import { hashAssetIds, MODULE_PREFIX } from './querykeys'

export type ScopedAssetIds = { scope: ChainScope; assetIds: string[] }

/** Stored assets by scope key, then asset id. */
export type StoredAssetsByScope = ReadonlyMap<
    ChainScopeKey,
    ReadonlyMap<string, PeraAsset>
>

export type UseStoredAssetsAcrossScopesQueryResult = {
    assets: StoredAssetsByScope
    /** What Pera says of an id the DB lacks, when the backend describes it. */
    unstoredVerdicts: ReadonlyMap<
        ChainScopeKey,
        ReadonlyMap<string, AssetVerdict>
    >
    /**
     * The ids each scope has an answer for. A requested id missing here is
     * still loading, or its lookup failed, so its absence from `assets` and
     * `unstoredVerdicts` says nothing about it.
     */
    readIds: ReadonlyMap<ChainScopeKey, ReadonlySet<string>>
}

type QueryData = UseStoredAssetsAcrossScopesQueryResult & {
    hasFailedLookup: boolean
}

const NOTHING_READ: UseStoredAssetsAcrossScopesQueryResult = {
    assets: new Map(),
    unstoredVerdicts: new Map(),
    readIds: new Map(),
}

const NO_VERDICTS: ReadonlyMap<string, AssetVerdict> = new Map()

const logLookupFailure = (context: Record<string, unknown>, error: unknown) => {
    const message = 'Asset verdict lookup failed'
    if (isChainRefusedError(error) || isPeraServiceUnavailableError(error)) {
        logger.debug(message, { ...context, error })
    } else {
        logger.warn(message, { ...context, error })
    }
}

/**
 * The local DB's rows for ids spread over several scopes, in one query: a list
 * mixing networks needs them before it renders, where a hook per scope can't
 * be called. `fetchMissingTiers` asks the backend about each id the DB lacks,
 * without storing the answer.
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
        // A failed lookup stays stale, so a reconnect or refocus asks again.
        staleTime: query => (query.state.data?.hasFailedLookup ? 0 : Infinity),
        networkMode: 'always',
        // A list that grows page by page changes the key on every page; the
        // last answer keeps the ids it covers settled while the new ones load.
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<QueryData> => {
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
                        let verdicts = NO_VERDICTS
                        let hasFailedLookup = false
                        if (fetchMissingTiers && missing.length > 0) {
                            // ponytail: re-asks every unstored id on each page
                            // and sync; cache answers if that ever grows large.
                            const answer = await fetchAssetVerdicts(
                                missing,
                                group.scope,
                            ).catch(error => {
                                logLookupFailure(
                                    {
                                        scope: group.scope,
                                        count: missing.length,
                                    },
                                    error,
                                )
                                hasFailedLookup = true
                                return null
                            })
                            if (answer) verdicts = answer
                            else readIds = stored
                        }
                        const scopeKey = toScopeKey(group.scope)
                        return {
                            scopeKey,
                            rows: new Map(rows.map(row => [row.assetId, row])),
                            verdicts,
                            readIds,
                            hasFailedLookup,
                        }
                    }),
            )
            return {
                assets: new Map(entries.map(e => [e.scopeKey, e.rows])),
                unstoredVerdicts: new Map(
                    entries.map(e => [e.scopeKey, e.verdicts]),
                ),
                readIds: new Map(entries.map(e => [e.scopeKey, e.readIds])),
                hasFailedLookup: entries.some(e => e.hasFailedLookup),
            }
        },
    })
    return data ?? NOTHING_READ
}
