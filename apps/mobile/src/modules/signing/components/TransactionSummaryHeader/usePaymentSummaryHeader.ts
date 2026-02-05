import { ALGO_ASSET, useAssetFiatPricesQuery } from "@perawallet/wallet-core-assets"
import { microAlgosToAlgos, PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { useCurrency } from "@perawallet/wallet-core-currencies"
import Decimal from "decimal.js"
import { useMemo } from "react"

export const usePaymentSummaryHeader = (transaction: PeraDisplayableTransaction) => {
    const { preferredFiatCurrency, showAlgoAsPrimaryCurrency } = useCurrency()
    
        const { data: fiatPrices, isPending } = useAssetFiatPricesQuery(
            !showAlgoAsPrimaryCurrency,
        )
        const value = useMemo(() => {
            if (isPending) {
                return undefined
            }
            return (
                fiatPrices?.get(ALGO_ASSET.assetId)?.fiatPrice ?? new Decimal(0)
            ).mul(microAlgosToAlgos(transaction.paymentTransaction?.amount ?? 0n))
        }, [fiatPrices, isPending])

        return {
            preferredFiatCurrency,
            value
        }
}