import PWView from "../../common/view/PWView"
import AddressSearchView from "../../common/address-search/AddressSearchView"
import { useContext } from "react"
import { SendFundsContext } from "../../../providers/SendFundsProvider"

type SendFundsSelectDestinationProps = {
    onNext: () => void
}

const SendFundsSelectDestination = ({ onNext }: SendFundsSelectDestinationProps) => {
    const {setDestination} = useContext(SendFundsContext)

    const handleSelected = (address: string) => {
        setDestination(address)
        onNext()
    }

    return <AddressSearchView onSelected={handleSelected} />
}

export default SendFundsSelectDestination