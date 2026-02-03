import { TransactionSigningContext } from "@modules/transactions/components/signing/TransactionSigningContext/TransactionSigningContext"
import { TransactionSigningContextValue } from "@modules/transactions/models"
import { useContext } from "react"


export const useTransactionSigningContext = (): TransactionSigningContextValue => {
    const context = useContext(TransactionSigningContext)
    if (!context) {
        throw new Error(
            'useTransactionSigningContext must be used within a TransactionSigningProvider',
        )
    }
    return context
}