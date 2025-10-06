import { useV1AssetsList } from "../../api/index"
import { useAppStore } from "../../store/app-store"
import { ALGO_ASSET } from "./types"
import { useMemo } from "react"

export const useCachedAssets = (ids?: number[]) => {
    const assetIDs = useAppStore(state => state.assetIDs)
    const setAssetIDs = useAppStore(state => state.setAssetIDs)

    console.log("AssetIDs", assetIDs)

    if (ids && (!assetIDs || !ids.every(id => assetIDs?.find(a => a === id)))) {
        setAssetIDs([...assetIDs ?? [], ...ids])
    }    

    const { data, isPending } = useV1AssetsList({
        params: {
            asset_ids: [...assetIDs.values()].join(',')
        }
    })

    return useMemo(() => ({
        assets: [...data?.results ?? [], ALGO_ASSET],
        loading: isPending
    }), [data, isPending])

}