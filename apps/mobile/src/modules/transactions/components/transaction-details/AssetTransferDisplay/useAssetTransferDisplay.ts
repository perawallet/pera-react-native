import { useMemo } from "react"
import { getAssetTransferType } from "@perawallet/wallet-core-blockchain"
import { useSingleAssetDetailsQuery } from "@perawallet/wallet-core-assets"
import Decimal from "decimal.js"
import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { useStyles } from "./styles"
import { useModalState } from "@hooks/useModalState"

export const useAssetTransferDisplay = (transaction: PeraDisplayableTransaction, referenceAddress?: string) => {
    const styles = useStyles()

    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const assetId = transaction.assetTransferTransaction?.assetId?.toString()

    const { data: asset } = useSingleAssetDetailsQuery(assetId ?? '')

    const assetTransfer = transaction.assetTransferTransaction

    const senderAddress = transaction.sender
    const receiverAddress = assetTransfer?.receiver
    const amount = useMemo(() => {
        const amount = Decimal(assetTransfer?.amount?.toString() ?? '0')
        return amount
            .dividedBy(new Decimal(10 ** (asset?.decimals ?? 6)))
            .mul(referenceAddress === assetTransfer?.receiver ? -1 : 1)
    }, [assetTransfer?.amount, asset?.decimals])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [amount])

    const metadataHash = useMemo(() => asset?.metadata, [asset])
    const metadataHashDetailsModal = useModalState()

    return {
        transferType,
        showWarnings,
        assetId,
        asset,
        assetTransfer,
        senderAddress,
        receiverAddress,
        amount,
        amountStyle,
        metadataHash,
        isMetadataHashDetailsModalOpen: metadataHashDetailsModal.isOpen,
        openMetadataHashDetailsModal: metadataHashDetailsModal.open,
        closeMetadataHashDetailsModal: metadataHashDetailsModal.close,
    }
}