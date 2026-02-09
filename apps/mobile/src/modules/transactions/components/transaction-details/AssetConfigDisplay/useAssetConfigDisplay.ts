import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { getAssetConfigType } from "@perawallet/wallet-core-blockchain"
import { useClipboard } from "@hooks/useClipboard"
import { useMemo } from "react"
import Decimal from 'decimal.js'
import { formatNumber, formatWithUnits } from '@perawallet/wallet-core-shared'
import { useModalState } from "@hooks/useModalState"

export const useAssetConfigDisplay = (transaction: PeraDisplayableTransaction) => {
    const assetConfig = transaction.assetConfigTransaction

    const configType = getAssetConfigType(transaction)
    const assetId = assetConfig?.assetId
    const showWarnings = !transaction?.id
    const metadataHashDetailsModal = useModalState()

    const supply = useMemo(() => {
        const { amount, unit } = assetConfig?.params?.total
            ? formatWithUnits(Decimal(assetConfig?.params?.total.toString()))
            : { amount: undefined, unit: undefined }

        if (!amount) {
            return undefined
        }

        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetConfig?.params?.total])

    const metadataHash = useMemo(() => {
        if (!assetConfig?.params?.metadataHash) {
            return undefined
        }
        return Buffer.from(assetConfig?.params?.metadataHash).toString('utf-8')
    }, [assetConfig?.params?.metadataHash])

    return {
        assetConfig,
        configType,
        assetId,
        showWarnings,
        supply,
        metadataHash,
        openMetadataHashDetailsModal: metadataHashDetailsModal.open,
        closeMetadataHashDetailsModal: metadataHashDetailsModal.close,
        isMetadataHashDetailsModalVisible: metadataHashDetailsModal.isOpen,
    }
}