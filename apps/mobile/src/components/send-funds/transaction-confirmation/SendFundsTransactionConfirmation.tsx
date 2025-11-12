import PWView from "../../common/view/PWView"
import { Text } from "@rneui/themed"

type SendFundsTransactionConfirmationProps = {
    onNext: () => void
}
const SendFundsTransactionConfirmation = ({ onNext }: SendFundsTransactionConfirmationProps) => {
    return <PWView><Text>SendFundsTransactionConfirmation</Text></PWView>
}

export default SendFundsTransactionConfirmation