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

import { ALGO_ASSET, type PeraAsset } from '../../services/assets'
import { useV1AssetsList, v1AssetsListQueryKey } from '../../api/index'
import { useAppStore } from '../../store/app-store'
import { useEffect, useMemo } from 'react'

export const useAssetsQueryKeys = () => {
    let assetIDs = useAppStore(state => state.assetIDs)
    return useMemo(() => [v1AssetsListQueryKey({
        asset_ids: [...assetIDs.values()].join(','),
    })], [assetIDs])
}

export const useAssets = (ids?: number[]) => {
    let assetIDs = useAppStore(state => state.assetIDs)
    let updated = false
    const setAssetIDs = useAppStore(state => state.setAssetIDs)

    if (ids && (!assetIDs || !ids.every(id => assetIDs?.find(a => a === id)))) {
        const set = new Set([...(assetIDs ?? []), ...ids])
        assetIDs = [...set]
        updated = true
    }

    useEffect(() => {
        if (updated) {
            setAssetIDs(assetIDs)
        }
    }, [ids, assetIDs, setAssetIDs])

    const { data, isPending, isError, error, refetch, isLoading } = useV1AssetsList({
        params: {
            asset_ids: [...assetIDs.values()].join(','),
        },
    })

    return useMemo<{
        data: PeraAsset[],
        isPending: boolean,
        isError: boolean,
        error: unknown,
        refetch: () => void,
        isLoading: boolean
    }>(
        () => ({
            data: [...(data?.results?.map(({ usd_value, ...rest }) => rest) ?? []), ALGO_ASSET],
            isPending,
            isError,
            error,
            refetch,
            isLoading
        }),
        [data, isPending, isError, error, refetch, isLoading],
    )
}
