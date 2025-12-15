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
import { SendFundsContext } from '@providers/SendFundsProvider'
import {
    DEFAULT_PRECISION,
    formatCurrency,
} from '@perawallet/wallet-core-shared'

import RowTitledItem from '../../common/row-titled-item/RowTitledItem'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import AccountDisplay from '../../accounts/account-display/AccountDisplay'
import AddressDisplay from '../../address/address-display/AddressDisplay'
import { Divider, Text, useTheme } from '@rneui/themed'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import { useStyles } from './styles'
import PWButton from '../../common/button/PWButton'
import useToast from '@hooks/toast'
import AddNotePanel from '../add-note-panel/AddNotePanel'
import PWIcon from '../../common/icons/PWIcon'
import PWHeader from '../../common/header/PWHeader'
import {
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    ALGO_ASSET_ID,
    useAssetFiatPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/language'

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

    const { data: assets } = useAssetsQuery()
    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])

    const selectedAccount = useSelectedAccount()
    const { showToast } = useToast()
    const [noteOpen, setNoteOpen] = useState(false)
    const { preferredCurrency } = useCurrency()
    const { t } = useLanguage()
    const { data: fiatPrices } = useAssetFiatPricesQuery()
    const fiatPrice = useMemo<Decimal | null>(() => {
        const price = selectedAsset
            ? fiatPrices.get(selectedAsset?.assetId)?.fiatPrice
            : null
        if (price) {
            return amount?.mul(price) ?? null
        }
        return null
    }, [selectedAsset, fiatPrices, amount])

    const openNote = () => {
        setNoteOpen(true)
    }

    const closeNote = () => {
        setNoteOpen(false)
    }

    const { data: currentBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        selectedAsset?.assetId,
    )

    const onSuccess = () => {
        showToast({
            title: 'Transfer Successful',
            body: `You successfully sent ${formatCurrency(
                amount!,
                asset?.decimals ?? DEFAULT_PRECISION,
                asset?.unitName ?? '',
                'en-US',
                false,
                undefined,
                2,
            )} ${asset?.unitName ?? ''}.`,
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

        if (selectedAsset.assetId === ALGO_ASSET_ID) {
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
                title={t('send_funds.confirmation.title')}
                onLeftPress={onBack}
            />
            <RowTitledItem title={t('send_funds.confirmation.amount')}>
                <CurrencyDisplay
                    h3
                    currency={asset?.unitName ?? ''}
                    precision={asset?.decimals ?? DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    showSymbol
                    value={amount ?? Decimal(0)}
                />
                <CurrencyDisplay
                    style={styles.secondaryAmount}
                    currency={preferredCurrency}
                    precision={asset?.decimals ?? DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    showSymbol
                    value={fiatPrice ? amount.mul(fiatPrice) : null}
                />
            </RowTitledItem>
            <Divider style={styles.divider} />
            {!!selectedAccount && (
                <RowTitledItem title={t('send_funds.confirmation.account')}>
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
                <RowTitledItem title={t('send_funds.confirmation.to')}>
                    <AddressDisplay
                        address={destination}
                        showCopy={false}
                    />
                </RowTitledItem>
            )}
            <RowTitledItem title={t('send_funds.confirmation.fee')}>
                <Text>{t('send_funds.confirmation.tbd')}</Text>
            </RowTitledItem>
            <Divider style={styles.divider} />
            {currentBalance && (
                <RowTitledItem
                    title={t('send_funds.confirmation.current_balance')}
                >
                    <CurrencyDisplay
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        showSymbol
                        value={currentBalance.amount}
                    />
                    <CurrencyDisplay
                        currency={preferredCurrency}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        showSymbol
                        value={currentBalance.fiatValue}
                    />
                </RowTitledItem>
            )}
            <Divider style={styles.divider} />
            <RowTitledItem title={t('send_funds.confirmation.note')}>
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
                        <Text style={styles.link}>
                            {t('send_funds.confirmation.edit')}
                        </Text>
                    </PWTouchableOpacity>
                )}
                {!note && (
                    <PWTouchableOpacity>
                        <Text
                            style={styles.link}
                            onPress={openNote}
                        >
                            {t('send_funds.add_note.button')}
                        </Text>
                    </PWTouchableOpacity>
                )}
            </RowTitledItem>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('send_funds.confirmation.confirm_button')}
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
