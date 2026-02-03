import { PeraDisplayableTransaction, TransactionSignRequest } from "@perawallet/wallet-core-blockchain"

export type TransactionWarning = {
    type: 'close' | 'rekey'
    senderAddress: string
    targetAddress: string
}

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
