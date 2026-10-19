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
import { useQuery } from '@tanstack/react-query'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    fetchAssetGroups,
    toAssetGroups,
    type AssetGroupsResponse,
} from '../api'
import type { AssetGroup } from '../models'
import { getAssetGroupsQueryKey } from './querykeys'

const ASSET_GROUPS_STALE_TIME_MS = 60 * 60 * 1000

const EMPTY_GROUPS: AssetGroup[] = []

export type UseAssetGroupsQueryParams = {
    /** Off where nothing could group, so the request isn't sent at all. */
    enabled?: boolean
}

export type UseAssetGroupsQueryResult = {
    groups: AssetGroup[]
    isPending: boolean
}

/** A failed read yields no groups, so callers fall back to ungrouped assets. */
export const useAssetGroupsQuery = ({
    enabled = true,
}: UseAssetGroupsQueryParams = {}): UseAssetGroupsQueryResult => {
    const deployment = useWalletDeployment()
    const query = useQuery({
        queryKey: getAssetGroupsQueryKey(deployment),
        queryFn: () => fetchAssetGroups(deployment),
        enabled,
        staleTime: ASSET_GROUPS_STALE_TIME_MS,
        // A failed read isn't retried each time a list mounts: every failure
        // is logged, and the list is whole without groups.
        retryOnMount: false,
        select: useCallback(
            (data: AssetGroupsResponse) =>
                toAssetGroups(data, getProvider().chains),
            [],
        ),
    })

    return {
        groups: query.data ?? EMPTY_GROUPS,
        isPending: query.isPending,
    }
}
