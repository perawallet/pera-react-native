import { useQueryClient } from "@tanstack/react-query"

export const useInvalidateAssetPrices = () => {
    const queryClient = useQueryClient()

    const invalidateAssetPrices = () => {
        queryClient.invalidateQueries({
            predicate: query => query.queryKey.join('/').startsWith('assets/prices')
        })
    }

    return {
        invalidateAssetPrices
    }
}