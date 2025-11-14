import PWView from "../../common/view/PWView"
import Decimal from "decimal.js"
import { useContext, useMemo, useState } from "react"
import CurrencyDisplay from "../../common/currency-display/CurrencyDisplay"
import { useStyles } from "./styles"
import PWButton from "../../common/button/PWButton"
import AccountAssetItemView from "../../assets/asset-item/AccountAssetItemView"
import { Button } from "@rneui/themed"
import NumberPad from "../../common/number-pad/NumberPad"
import { SendFundsContext } from "../../../providers/SendFundsProvider"
import SendFundsTitlePanel from "../title-panel/SendFundsTitlePanel"
import AddNotePanel from "../add-note-panel/AddNotePanel"
import useToast from "hooks/toast"
import { useAccountBalances, useSelectedAccount } from "@perawallet/core"

type SendFundsInputViewProps = {
    onNext: () => void
    onBack: () => void
}

//TODO: handle local currency conversion
//TODO: handle max precision (currently we don't show them but we're still adding characters)
//TODO: handle max button & max amount validation (+ max amount popup)
//TODO: Should be using DMMono font for numbers
const SendFundsInputView = ({onNext, onBack}: SendFundsInputViewProps) => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { selectedAsset, note, setNote, setAmount } = useContext(SendFundsContext)
    const [value, setValue] = useState<string | null>()
    const [noteOpen, setNoteOpen] = useState(false)
    const { showToast } = useToast()

    const { data } = useAccountBalances(selectedAccount ? [selectedAccount] : [])
    const { algoAmount, usdAmount } = useMemo(() => {
        const asset = data.at(0)?.accountInfo?.results?.find((info) => info.asset_id === selectedAsset?.asset_id)
        return {
            algoAmount: asset?.amount ? Decimal(asset?.amount) : Decimal(0),
            usdAmount: asset?.balance_usd_value ?  Decimal(asset?.balance_usd_value) : Decimal(0),
        }
    }, [data])

    const openNote = () => {
        setNoteOpen(true)
    }

    const closeNote = () => {
        setNoteOpen(false)
    }

    const handleNext = () => {
        if (!value || Decimal(value) <= Decimal(0)) {
            showToast({
                title: 'Invalid Amount',
                body: 'Please enter a valid amount.',
                type: 'error'
            })
        }
        setAmount(Decimal(value ?? '0'))
        setNote(note ?? undefined)
        onNext()
    }

    const handleKey = (key?: string) => {
        if (key) {
            setValue((value ?? "") + key)
        } else {
            if (value?.length) {
                const newValue = value.substring(0, value.length - 1)
                if (newValue.length) {
                    setValue(newValue)
                } else {
                    setValue(null)
                }
            }
        }
    }

    if (!selectedAsset) return <></>

    return <PWView style={styles.container}>
        <SendFundsTitlePanel handleBack={onBack} screenState="input-amount" />
        <CurrencyDisplay h1 currency={selectedAsset.unit_name} precision={selectedAsset.fraction_decimals} 
            value={value ? Decimal(value) : Decimal(0)} h1Style={value ? styles.amount : styles.amountPlaceholder} 
            showSymbol={false} minPrecision={2} />
        <CurrencyDisplay currency={'USD'} precision={6} 
            value={value ? Decimal(value) : Decimal(0)} style={styles.amountPlaceholder} 
            showSymbol minPrecision={2} />

        <PWView style={styles.buttonContainer}>
            <Button title={!!note ? 'Edit Note' : `+ Add Note`} buttonStyle={styles.secondaryButton} titleStyle={styles.secondaryButtonTitle} onPress={openNote}/>
            <Button title="MAX" buttonStyle={styles.secondaryButton} titleStyle={styles.secondaryButtonTitle}  />
        </PWView>

        <PWView style={styles.numpadContainer}>
            <NumberPad onPress={handleKey} />
        </PWView>

        <AccountAssetItemView asset={selectedAsset} amount={algoAmount} localAmount={usdAmount} style={styles.assetDisplay} />
            
        <PWButton variant="primary" 
            title="Next" containerStyle={styles.nextButton} onPress={handleNext} disabled={!value} />

        <AddNotePanel isVisible={noteOpen} onClose={closeNote}/>
    </PWView>
}

export default SendFundsInputView
