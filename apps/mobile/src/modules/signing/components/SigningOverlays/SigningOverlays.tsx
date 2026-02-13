import { SignRequestBottomSheet } from '../SignRequestBottomSheet'
import { SigningCompletedBottomSheet } from '../SigningCompletedBottomSheet'
import { TransactionRequestFAQBottomSheet } from '../TransactionRequestFAQBottomSheet'

export const SigningOverlays = () => (
    <>
        <SignRequestBottomSheet />
        <SigningCompletedBottomSheet />
        <TransactionRequestFAQBottomSheet />
    </>
)
