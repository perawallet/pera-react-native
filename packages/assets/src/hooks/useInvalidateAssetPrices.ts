import { useQueryClient } from "@tanstack/react-query"
import { getBaseAssetFiatPricesQueryKey, } from "./useAssetFiatPricesQuery"
import { getBaseAssetPriceHistoryQueryKey } from "./useAssetPriceHistoryQuery"

export const useInvalidateAssetPrices = () => {
    const queryClient = useQueryClient()

    const invalidateAssetPrices = () => {
        queryClient.invalidateQueries({
            predicate: query => query.queryKey.join('/').startsWith(getBaseAssetFiatPricesQueryKey().join('/'))
                || query.queryKey.join('/').startsWith(getBaseAssetPriceHistoryQueryKey().join('/'))
        })
    }

    return {
        invalidateAssetPrices
    }
}