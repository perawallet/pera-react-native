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

import { useV1AssetsList } from '../../api/index'
import { useAppStore } from '../../store/app-store'
import { ALGO_ASSET } from './types'
import { useEffect, useMemo } from 'react'

export const useCachedAssets = (ids?: number[]) => {
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

    const { data, isPending } = useV1AssetsList({
        params: {
            asset_ids: [...assetIDs.values()].join(','),
        },
    })

    return useMemo(
        () => ({
            assets: [...(data?.results ?? []), ALGO_ASSET],
            loading: isPending,
        }),
        [data, isPending],
    )
}
