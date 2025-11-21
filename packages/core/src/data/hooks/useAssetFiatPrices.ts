import { config } from "@perawallet/config"
import { useV1AssetsList, v1AssetsListQueryKey } from "../../api/index"
import { useAppStore } from "../../store/app-store"
import { useMemo } from "react"
import { useCurrencyConverter } from "../../services/currencies"
import Decimal from "decimal.js"

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

export const useAssetFiatPricesQueryKeys = () => {
    return [v1AssetsListQueryKey()]
}

export const useAssetFiatPrices = () => {
    let assetIDs = useAppStore(state => state.assetIDs)
    let { usdToPreferred } = useCurrencyConverter()

    const { data, isPending, isError, error, refetch, isLoading } = useV1AssetsList({
        params: {
            asset_ids: [...assetIDs.values()].join(','),
        },
    }, {
        query: {
            staleTime: config.reactQueryShortLivedStaleTime,
            gcTime: config.reactQueryShortLivedGCTime,
        }
    })

    return useMemo<{
        data: Map<number, Decimal>,
        isPending: boolean,
        isError: boolean,
        error: unknown,
        refetch: () => void,
        isLoading: boolean
    }>(() => {
        return {
            data: new Map<number, Decimal>(data?.results?.filter(r => r.usd_value != null).map(r => [
                r.asset_id, usdToPreferred(Decimal(r.usd_value!))
            ])),
            isPending, isError, error, refetch, isLoading
        }

    }, [data, isPending, isError, error, refetch, isLoading, usdToPreferred])
}
