import { PeraDisplayableTransaction, TransactionSignRequest } from "@perawallet/wallet-core-blockchain"
import { AggregatedWarning } from "../components/signing/TransactionSigningContext/TransactionSigningContext"


export type TransactionSigningContextValue = {
    request: TransactionSignRequest
    groups: PeraDisplayableTransaction[][]
    allTransactions: PeraDisplayableTransaction[]
    totalFee: bigint
    isSingleTransaction: boolean
    isSingleGroup: boolean
    isMultipleGroups: boolean
    isLoading: boolean
    aggregatedWarnings: AggregatedWarning[]
    signAndSend: () => Promise<void>
    rejectRequest: () => void
}