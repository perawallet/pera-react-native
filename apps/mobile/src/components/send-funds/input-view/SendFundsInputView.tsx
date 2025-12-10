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

import PWView from '../../common/view/PWView'
import Decimal from 'decimal.js'
import { useContext, useMemo, useState } from 'react'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import { useStyles } from './styles'
import PWButton from '../../common/button/PWButton'
import AccountAssetItemView from '../../assets/asset-item/AccountAssetItemView'
import { Button, Text } from '@rneui/themed'
import NumberPad from '../../common/number-pad/NumberPad'
import { SendFundsContext } from '../../../providers/SendFundsProvider'
import AddNotePanel from '../add-note-panel/AddNotePanel'
import useToast from '../../../hooks/toast'
import PWHeader from '../../common/header/PWHeader'
import AccountDisplay from '../../accounts/account-display/AccountDisplay'
import SendFundsInfoPanel from '../info-panel/SendFundsInfoPanel'
import {
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    useAssetFiatPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useLanguage } from '../../../hooks/useLanguage'

type SendFundsInputViewProps = {
    onNext: () => void
    onBack: () => void
}

//TODO: handle max precision (currently we don't show them but we're still adding characters)
//TODO: max amount validation (+ max amount popup)
const SendFundsInputView = ({ onNext, onBack }: SendFundsInputViewProps) => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { preferredCurrency } = useCurrency()
    const { canSelectAsset, selectedAsset, note, setNote, setAmount } =
        useContext(SendFundsContext)
    const [value, setValue] = useState<string | null>()
    const [noteOpen, setNoteOpen] = useState(false)
    const [infoOpen, setInfoOpen] = useState(false)
    const { showToast } = useToast()
    const { t } = useLanguage()

    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const { data: assets } = useAssetsQuery()

    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])
    const { data: fiatPrices } = useAssetFiatPricesQuery()
    const fiatPrice = useMemo(
        () =>
            selectedAsset?.assetId
                ? (fiatPrices.get(selectedAsset?.assetId)?.fiatPrice ?? null)
                : null,
        [selectedAsset, fiatPrices],
    )

    const tokenBalance = useMemo(() => {
        if (!selectedAccount) {
            return null
        }
        const assetToUse = accountBalances
            ?.get(selectedAccount.address)
            ?.assetBalances?.find(b => b.assetId === selectedAsset?.assetId)
        const assetAmount = assetToUse?.amount ?? Decimal(0)
        return assetAmount
    }, [accountBalances, selectedAsset?.assetId, selectedAccount])

    const openNote = () => {
        setNoteOpen(true)
    }

    const closeNote = () => {
        setNoteOpen(false)
    }

    const openInfo = () => {
        setInfoOpen(true)
    }
    const closeInfo = () => {
        setInfoOpen(false)
    }

    const setMax = () => {
        setAmount(tokenBalance ?? Decimal(0))
    }

    const handleNext = () => {
        if (!value || Decimal(value) <= Decimal(0)) {
            showToast({
                title: t('send_funds.input.error_title'),
                body: t('send_funds.input.error_body'),
                type: 'error',
            })
        }
        setAmount(Decimal(value ?? '0'))
        setNote(note ?? undefined)
        onNext()
    }

    const handleKey = (key?: string) => {
        if (key) {
            setValue((value ?? '') + key)
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

    const fiatValue = useMemo(() => {
        if (!value || !fiatPrice) {
            return null
        }

        return Decimal(value).mul(fiatPrice)
    }, [value, fiatPrice])

    if (!asset || !selectedAsset) return <></>

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon={!canSelectAsset ? 'chevron-left' : 'cross'}
                onLeftPress={onBack}
                rightIcon='info'
                onRightPress={openInfo}
            >
                <Text>
                    {t('send_funds.input_view.title', { asset: asset?.name })}
                </Text>
                <AccountDisplay
                    account={selectedAccount ?? undefined}
                    style={styles.accountDisplay}
                    iconProps={{ width: 16, height: 16 }}
                    textProps={{ style: styles.accountDisplaySubHeading }}
                    showChevron={false}
                />
            </PWHeader>
            <CurrencyDisplay
                currency={asset.unitName ?? ''}
                precision={asset.decimals}
                value={value ? Decimal(value) : Decimal(0)}
                style={[
                    value ? styles.amount : styles.amountPlaceholder,
                    styles.h1,
                ]} //h1Style doesn't seem to override fontfamily
                showSymbol={false}
                minPrecision={2}
            />
            {fiatValue ? (
                <CurrencyDisplay
                    currency={preferredCurrency}
                    precision={6}
                    value={fiatValue}
                    style={styles.amountPlaceholder}
                    showSymbol
                    minPrecision={2}
                />
            ) : (
                <Text style={styles.amountPlaceholder}>--</Text>
            )}

            <PWView style={styles.buttonContainer}>
                <Button
                    title={
                        note
                            ? t('send_funds.confirmation.edit')
                            : t('send_funds.add_note.button')
                    }
                    buttonStyle={styles.secondaryButton}
                    titleStyle={styles.secondaryButtonTitle}
                    onPress={openNote}
                />
                <Button
                    title={t('send_funds.input.max')}
                    buttonStyle={styles.secondaryButton}
                    titleStyle={styles.secondaryButtonTitle}
                    onPress={setMax}
                />
            </PWView>

            <PWView style={styles.numpadContainer}>
                <NumberPad onPress={handleKey} />
            </PWView>

            <AccountAssetItemView
                accountBalance={selectedAsset}
                style={styles.assetDisplay}
            />

            <PWButton
                variant='primary'
                title={t('send_funds.input.next')}
                style={styles.nextButton}
                onPress={handleNext}
                disabled={!value}
            />

            <AddNotePanel
                isVisible={noteOpen}
                onClose={closeNote}
            />
            <SendFundsInfoPanel
                isVisible={infoOpen}
                onClose={closeInfo}
            />
        </PWView>
    )
}

export default SendFundsInputView
