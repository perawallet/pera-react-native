import { PeraDisplayableTransaction } from "@perawallet/wallet-core-blockchain"
import { TransactionSignRequest, TransactionWarning } from "@perawallet/wallet-core-signing"

export type { TransactionWarning } from "@perawallet/wallet-core-signing"

export type TransactionSigningContextValue = {
    request: TransactionSignRequest
    groups: PeraDisplayableTransaction[][]
    allTransactions: PeraDisplayableTransaction[]
    totalFee: bigint
    isSingleTransaction: boolean
    isSingleGroup: boolean
    isMultipleGroups: boolean
    isLoading: boolean
    aggregatedWarnings: TransactionWarning[]
    signAndSend: () => Promise<void>
    rejectRequest: () => void
}
