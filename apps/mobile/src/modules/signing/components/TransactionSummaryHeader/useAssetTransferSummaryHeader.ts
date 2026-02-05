import { ALGO_ASSET_ID, useAssetFiatPricesQuery, useSingleAssetDetailsQuery } from "@perawallet/wallet-core-assets"
import { getAssetTransferType, PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { useCurrency } from "@perawallet/wallet-core-currencies"
import Decimal from "decimal.js"
import { useMemo } from "react"

export const useAssetTransferSummaryHeader = (transaction : PeraDisplayableTransaction) => {

    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const { preferredFiatCurrency, showAlgoAsPrimaryCurrency } = useCurrency()

    const label = useMemo(() => {
        switch (transferType) {
            case 'opt-in':
                return 'transactions.summary.opt_in'
            case 'opt-out':
                return 'transactions.summary.opt_out'
            case 'clawback':
                return 'transactions.summary.clawback'
            default:
                return 'transactions.summary.transfer'
        }
    }, [transferType])

    const receiver = useMemo(() => {
        return transaction.assetTransferTransaction?.receiver ?? ''
    }, [transaction])

    const assetId = useMemo(() => {
        return transaction.assetTransferTransaction?.assetId?.toString() ?? ''
    }, [transaction])

    const microAmount = useMemo(() => {
        return transaction.assetTransferTransaction?.amount ?? 0n
    }, [transaction])

    const amount = useMemo(() => {
        return Decimal(microAmount).div(10 ** (asset?.decimals ?? 0))
    }, [transaction])

    const { data: asset, isPending } = useSingleAssetDetailsQuery(assetId)
    const { data: assetPrices, isPending: assetPricesPending } =
        useAssetFiatPricesQuery(!!assetId)

    const secondaryAssetName = useMemo(() => {
        if (showAlgoAsPrimaryCurrency) {
            return preferredFiatCurrency
        }
        return 'ALGO'
    }, [showAlgoAsPrimaryCurrency, asset])

    const value = useMemo(() => {
        if (assetPricesPending) {
            return undefined
        }

        if (showAlgoAsPrimaryCurrency) {
            const algoPrice =
                assetPrices?.get(ALGO_ASSET_ID)?.fiatPrice ?? new Decimal(0)
            const assetPrice =
                assetPrices?.get(assetId)?.fiatPrice ?? new Decimal(0)
            return assetPrice.mul(amount).div(algoPrice)
        }
        return (assetPrices?.get(assetId)?.fiatPrice ?? new Decimal(0)).mul(
            amount,
        )
    }, [assetPrices, isPending])

    return {
        label,
        asset,
        assetId,
        receiver,
        amount,
        secondaryAssetName,
        value
    }
}