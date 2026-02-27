import { useQueryClient } from "@tanstack/react-query"
import { getInvalidateAccountBalancesPredicate } from "./querykeys"

export const useAccountBalancesInvalidator = () => {
    const queryClient = useQueryClient()

    const invalidate = () => {
        queryClient.invalidateQueries({
            predicate: getInvalidateAccountBalancesPredicate
        })
    }

    return {
        invalidate
    }
}