import { useContext, useMemo } from "react"
import PWView from "../../common/view/PWView"
import { SendFundsContext } from "../../../providers/SendFundsProvider"
import { ALGO_ASSET_ID, formatCurrency, useAccountBalances, useAlgorandClient, useSelectedAccount } from "@perawallet/core"
import RowTitledItem from "../../common/row-titled-item/RowTitledItem"
import CurrencyDisplay from "../../common/currency-display/CurrencyDisplay"
import Decimal from "decimal.js"
import AccountDisplay from "../../common/account-display/AccountDisplay"
import AddressDisplay from "../../common/address-display/AddressDisplay"
import { Divider, Text, useTheme } from "@rneui/themed"
import PWTouchableOpacity from "../../common/touchable-opacity/PWTouchableOpacity"
import { useStyles } from "./styles"
import PWButton from "../../common/button/PWButton"
import useToast from "../../../hooks/toast"

type SendFundsTransactionConfirmationProps = {
    onNext: () => void
}

//TODO figure out fee calculation
//TODO add local currency conversion and display
//TODO add note
const SendFundsTransactionConfirmation = ({ onNext }: SendFundsTransactionConfirmationProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const {selectedAsset, amount, destination, note} = useContext(SendFundsContext)
    const selectedAccount = useSelectedAccount()
    const { showToast } = useToast()

    const { data } = useAccountBalances(selectedAccount ? [selectedAccount] : [])
    const currentBalance = useMemo(() => {
        const assetBalance = data.at(0)?.accountInfo?.results?.find(i => i.asset_id === selectedAsset?.id)
        return assetBalance ?? { amount: Decimal(0), balance_usd_value: Decimal(0) }
    }, [data, selectedAsset])

    const onSuccess = () => {
        showToast({
            title: "Transfer Successful",
            body: `You successfully sent ${formatCurrency(
                amount!,
                selectedAsset!.fractional_decimals,
                selectedAsset!.name,
                'en-US',
                false,
                undefined,
                2)} ${selectedAsset!.unit_name}.`,
            type: 'success'
        })
        onNext()
    }

    const handleConfirm = async () => {
        if (!selectedAccount || !selectedAsset || !destination || !amount) {
            showToast({
                title: "Invalid transaction",
                body: "Something appears to have gone wrong with this transaction.",
                type: "error"
            })
        }

        if (selectedAsset.id === ALGO_ASSET_ID) {
            //TODO types aren't right - we're using Decimal.toString and pasting into a BigInt...
            // const tx = await client.createTransaction.payment({
            //     sender: selectedAccount!.address,
            //     receiver: destination!,
            //     amount: microAlgos(0),
            //     note
            // })
            
            //TODO sign and send txs here once signing infra is in place
            // console.log("Signing not implemented yet", tx)
            onSuccess()
        } else {
            //TODO types aren't right - we're using Decimal.toString and pasting into a BigInt...
            // const tx = await client.createTransaction.assetTransfer({
            //     sender: selectedAccount!.address,
            //     receiver: destination!,
            //     assetId: selectedAsset.id,
            //     amount: BigInt(0),
            //     note
            // })
            
            //TODO sign and send txs here once signing infra is in place
            // console.log("Signing not implemented yet", tx)
            onSuccess()
        }
    }

    return <PWView style={styles.container}>
        <RowTitledItem title="Amount">
            <CurrencyDisplay h3 currency={selectedAsset.name} precision={selectedAsset.precision} minPrecision={2}
                showSymbol value={amount ?? Decimal(0)} />
            <CurrencyDisplay style={styles.secondaryAmount} currency={'USD'} precision={selectedAsset.precision} minPrecision={2}
                showSymbol value={amount ?? Decimal(0)} />
        </RowTitledItem>
        <Divider style={styles.divider} />
        {!!selectedAccount && <RowTitledItem title="Account">
            <AccountDisplay account={selectedAccount} showChevron={false} iconProps={{width: theme.spacing.xl, height: theme.spacing.xl}}/>
        </RowTitledItem>}
        {!!destination && <RowTitledItem title="To">
            <AddressDisplay address={destination} showCopy={false} />
        </RowTitledItem>}
        <RowTitledItem title="Fee">
            <Text>TBD</Text>
        </RowTitledItem>
        <Divider style={styles.divider} />
        {currentBalance && <RowTitledItem title="Current Balance">
            <CurrencyDisplay currency={selectedAsset.name} precision={selectedAsset.precision} minPrecision={2}
                showSymbol value={currentBalance.amount ? Decimal(currentBalance.amount) : Decimal(0)} />
            <CurrencyDisplay currency={'USD'} precision={selectedAsset.precision} minPrecision={2}
                showSymbol value={currentBalance.balance_usd_value ? Decimal(currentBalance.balance_usd_value) : Decimal(0)} />
        </RowTitledItem>}
        <Divider style={styles.divider} />
        <RowTitledItem title="Note">
            {!!note && <Text>{note}</Text>}
            {!note && <PWTouchableOpacity><Text style={styles.link}>+ Add Note</Text></PWTouchableOpacity>}
        </RowTitledItem>
        <PWView style={styles.buttonContainer}>
            <PWButton title="Confirm transfer" variant="primary" onPress={handleConfirm}/>
        </PWView>
    </PWView>
}

export default SendFundsTransactionConfirmation