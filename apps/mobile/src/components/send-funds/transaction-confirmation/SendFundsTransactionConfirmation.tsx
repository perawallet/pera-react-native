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
    useAccountAssetBalance,
    useAssetFiatPrices,
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

type Balance = {
    cryptoAmount: Decimal | null
    fiatAmount: Decimal | null
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
    const { preferredCurrency, usdToPreferred } = useCurrencyConverter()
    const { data: fiatPrices } = useAssetFiatPrices()
    const fiatPrice = useMemo<Decimal | null>(() => {
        const price = selectedAsset
            ? fiatPrices.get(selectedAsset?.asset_id)
            : null
        if (price) {
            return amount?.mul(price) ?? null
        }
        return null
    }, [selectedAsset, fiatPrices])

    const openNote = () => {
        setNoteOpen(true)
    }

    const closeNote = () => {
        setNoteOpen(false)
    }

    const { data } = useAccountAssetBalance(
        selectedAccount ?? undefined,
        selectedAsset?.asset_id,
    )
    const currentBalance = useMemo<Balance>(() => {
        const { amount, balance_usd_value } = data ?? {}
        return data
            ? {
                  cryptoAmount: amount ? Decimal(amount) : null,
                  fiatAmount: balance_usd_value
                      ? usdToPreferred(Decimal(balance_usd_value))
                      : null,
              }
            : ({
                  cryptoAmount: Decimal(0),
                  fiatAmount: Decimal(0),
              } as Balance)
    }, [data, selectedAsset])

    const onSuccess = () => {
        showToast({
            title: 'Transfer Successful',
            body: `You successfully sent ${formatCurrency(
                amount!,
                selectedAsset!.fraction_decimals,
                selectedAsset!.unit_name ?? '',
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
            return
        }

        if (selectedAsset.asset_id === ALGO_ASSET_ID) {
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
                    currency={selectedAsset.unit_name ?? ''}
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
                    value={fiatPrice ? amount.mul(fiatPrice) : null}
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
                        currency={selectedAsset.unit_name ?? ''}
                        precision={selectedAsset.fraction_decimals}
                        minPrecision={2}
                        showSymbol
                        value={currentBalance.cryptoAmount}
                    />
                    <CurrencyDisplay
                        currency={preferredCurrency}
                        precision={selectedAsset.fraction_decimals}
                        minPrecision={2}
                        showSymbol
                        value={currentBalance.fiatAmount}
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
