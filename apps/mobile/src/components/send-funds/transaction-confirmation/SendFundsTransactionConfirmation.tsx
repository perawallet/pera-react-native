/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useContext, useMemo, useState } from 'react'
import PWView from '../../common/view/PWView'
import { SendFundsContext } from '../../../providers/SendFundsProvider'
import {
    ALGO_ASSET_ID,
    formatCurrency,
    useAccountBalances,
    useCurrencyConverter,
    useSelectedAccount,
} from '@perawallet/core'
import RowTitledItem from '../../common/row-titled-item/RowTitledItem'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import AccountDisplay from '../../accounts/account-display/AccountDisplay'
import AddressDisplay from '../../address/address-display/AddressDisplay'
import { Divider, Text, useTheme } from '@rneui/themed'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import { useStyles } from './styles'
import PWButton from '../../common/button/PWButton'
import useToast from '../../../hooks/toast'
import AddNotePanel from '../add-note-panel/AddNotePanel'
import PWIcon from '../../common/icons/PWIcon'
import PWHeader from '../../common/header/PWHeader'

type SendFundsTransactionConfirmationProps = {
    onNext: () => void
    onBack: () => void
}

//TODO figure out fee calculation
const SendFundsTransactionConfirmation = ({
    onNext,
    onBack,
}: SendFundsTransactionConfirmationProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const { selectedAsset, amount, destination, note } =
        useContext(SendFundsContext)
    const selectedAccount = useSelectedAccount()
    const { showToast } = useToast()
    const [noteOpen, setNoteOpen] = useState(false)
    const { preferredCurrency, convertAssetValueToPreferredCurrency } =
        useCurrencyConverter()
    const usdAssetPrice = useMemo(
        () =>
            selectedAsset?.usd_price
                ? Decimal(selectedAsset?.usd_price)
                : Decimal(0),
        [selectedAsset?.usd_price],
    )

    const openNote = () => {
        setNoteOpen(true)
    }

    const closeNote = () => {
        setNoteOpen(false)
    }

    const { data } = useAccountBalances(
        selectedAccount ? [selectedAccount] : [],
    )
    const currentBalance = useMemo(() => {
        const assetBalance = data
            .at(0)
            ?.accountInfo?.results?.find(i => i.asset_id === selectedAsset?.id)
        return (
            assetBalance ?? {
                amount: Decimal(0),
                balance_usd_value: Decimal(0),
            }
        )
    }, [data, selectedAsset])

    const onSuccess = () => {
        showToast({
            title: 'Transfer Successful',
            body: `You successfully sent ${formatCurrency(
                amount!,
                selectedAsset!.fractional_decimals,
                selectedAsset!.name,
                'en-US',
                false,
                undefined,
                2,
            )} ${selectedAsset!.unit_name}.`,
            type: 'success',
        })
        onNext()
    }

    const handleConfirm = async () => {
        if (!selectedAccount || !selectedAsset || !destination || !amount) {
            showToast({
                title: 'Invalid transaction',
                body: 'Something appears to have gone wrong with this transaction.',
                type: 'error',
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

    //not ready to render yet
    if (!selectedAccount || !selectedAsset || !amount) {
        return <></>
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon='chevron-left'
                title='Confirm Transaction'
                onLeftPress={onBack}
            />
            <RowTitledItem title='Amount'>
                <CurrencyDisplay
                    h3
                    currency={selectedAsset.name}
                    precision={selectedAsset.fraction_decimals}
                    minPrecision={2}
                    showSymbol
                    value={amount ?? Decimal(0)}
                />
                <CurrencyDisplay
                    style={styles.secondaryAmount}
                    currency={preferredCurrency}
                    precision={selectedAsset.fraction_decimals}
                    minPrecision={2}
                    showSymbol
                    value={convertAssetValueToPreferredCurrency(
                        amount ?? Decimal(0),
                        usdAssetPrice,
                    )}
                />
            </RowTitledItem>
            <Divider style={styles.divider} />
            {!!selectedAccount && (
                <RowTitledItem title='Account'>
                    <AccountDisplay
                        account={selectedAccount}
                        showChevron={false}
                        iconProps={{
                            width: theme.spacing.xl,
                            height: theme.spacing.xl,
                        }}
                    />
                </RowTitledItem>
            )}
            {!!destination && (
                <RowTitledItem title='To'>
                    <AddressDisplay
                        address={destination}
                        showCopy={false}
                    />
                </RowTitledItem>
            )}
            <RowTitledItem title='Fee'>
                <Text>TBD</Text>
            </RowTitledItem>
            <Divider style={styles.divider} />
            {currentBalance && (
                <RowTitledItem title='Current Balance'>
                    <CurrencyDisplay
                        currency={selectedAsset.name}
                        precision={selectedAsset.precision}
                        minPrecision={2}
                        showSymbol
                        value={
                            currentBalance.amount
                                ? Decimal(currentBalance.amount)
                                : Decimal(0)
                        }
                    />
                    <CurrencyDisplay
                        currency={preferredCurrency}
                        precision={selectedAsset.precision}
                        minPrecision={2}
                        showSymbol
                        value={convertAssetValueToPreferredCurrency(
                            currentBalance.balance_usd_value
                                ? Decimal(currentBalance.balance_usd_value)
                                : Decimal(0),
                            usdAssetPrice,
                        )}
                    />
                </RowTitledItem>
            )}
            <Divider style={styles.divider} />
            <RowTitledItem title='Note'>
                {!!note && <Text>{note}</Text>}
                {!!note && (
                    <PWTouchableOpacity
                        onPress={openNote}
                        style={styles.linkContainer}
                    >
                        <PWIcon
                            name='edit-pen'
                            variant='link'
                            size='sm'
                        />
                        <Text style={styles.link}>Edit</Text>
                    </PWTouchableOpacity>
                )}
                {!note && (
                    <PWTouchableOpacity>
                        <Text
                            style={styles.link}
                            onPress={openNote}
                        >
                            + Add Note
                        </Text>
                    </PWTouchableOpacity>
                )}
            </RowTitledItem>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title='Confirm transfer'
                    variant='primary'
                    onPress={handleConfirm}
                />
            </PWView>

            <AddNotePanel
                isVisible={noteOpen}
                onClose={closeNote}
            />
        </PWView>
    )
}

export default SendFundsTransactionConfirmation
