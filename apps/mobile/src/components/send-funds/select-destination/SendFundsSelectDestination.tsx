import PWView from "../../common/view/PWView"
import AddressSearchView from "../../common/address-search/AddressSearchView"
import { useContext } from "react"
import { SendFundsContext } from "../../../providers/SendFundsProvider"
import SendFundsTitlePanel from "../title-panel/SendFundsTitlePanel"
import { useStyles } from "./styles"

type SendFundsSelectDestinationProps = {
    onNext: () => void
    onBack: () => void
}

const SendFundsSelectDestination = ({ onNext, onBack }: SendFundsSelectDestinationProps) => {
    const {setDestination} = useContext(SendFundsContext)
    const styles = useStyles()

    const handleSelected = (address: string) => {
        setDestination(address)
        onNext()
    }

    return <PWView style={styles.container}>
        <SendFundsTitlePanel handleBack={onBack} screenState="select-destination" />
        <AddressSearchView onSelected={handleSelected} />
    </PWView>
}

export default SendFundsSelectDestination