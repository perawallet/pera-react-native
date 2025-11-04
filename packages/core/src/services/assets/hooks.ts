import { useV1AssetsList } from '../../api/index'
import { useAppStore } from '../../store/app-store'
import { ALGO_ASSET } from './types'
import { useEffect, useMemo } from 'react'

export const useCachedAssets = (ids?: number[]) => {
    let assetIDs = useAppStore(state => state.assetIDs)
    let updated = false
    const setAssetIDs = useAppStore(state => state.setAssetIDs)

    if (ids && (!assetIDs || !ids.every(id => assetIDs?.find(a => a === id)))) {
        var set = new Set([...(assetIDs ?? []), ...ids])
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
