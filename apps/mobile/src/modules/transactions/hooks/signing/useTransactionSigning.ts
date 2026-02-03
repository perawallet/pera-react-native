import { TransactionSigningContext } from "@modules/transactions/components/signing/SigningContextProvider/SigningContextProvider"
import { TransactionSigningContextValue } from "@modules/transactions/models"
import { useContext } from "react"


export const useTransactionSigningContext = (): TransactionSigningContextValue => {
    const context = useContext(TransactionSigningContext)
    if (!context) {
        throw new Error(
            'useTransactionSigningContext must be used within a SigningContextProvider initialied with a TransactionSignRequest',
        )
    }
    return context
}