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

import { PWView } from '@components/core/PWView'
import Decimal from 'decimal.js'
import { useContext } from 'react'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useStyles } from './styles'
import { PWButton } from '@components/core/PWButton'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { PWText } from '@components/core/PWText'
import { NumberPad } from '@components/NumberPad'
import { SendFundsContext } from '@modules/transactions/providers/SendFundsProvider'
import { AddNotePanel } from '../AddNotePanel'
import { PWHeader } from '@components/core/PWHeader'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { SendFundsInfoPanel } from '../InfoPanel/SendFundsInfoPanel'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { LoadingView } from '@components/LoadingView'
import { useInputView } from '@modules/transactions/hooks/send-funds/use-input-view'
import { useLanguage } from '@hooks/language'
import { useModalState } from '@hooks/modal-state'

export type SendFundsInputViewProps = {
    onNext: () => void
    onBack: () => void
}

//TODO: handle max precision (currently we don't show them but we're still adding characters)
//TODO: max amount validation (+ max amount popup)
export const SendFundsInputView = ({
    onNext,
    onBack,
}: SendFundsInputViewProps) => {
    const styles = useStyles()
    const {
        asset,
        selectedAsset,
        params,
        accountInformation,
        cryptoValue,
        fiatValue,
        setMax,
        handleKey,
        handleNext,
    } = useInputView(onNext)
    const { preferredCurrency } = useCurrency()
    const selectedAccount = useSelectedAccount()
    const { canSelectAsset, note } = useContext(SendFundsContext)
    const { t } = useLanguage()
    const noteState = useModalState()
    const infoState = useModalState()

    if (!asset || !selectedAsset || !params || !accountInformation) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon={!canSelectAsset ? 'chevron-left' : 'cross'}
                onLeftPress={onBack}
                rightIcon='info'
                onRightPress={infoState.open}
            >
                <PWText>
                    {t('send_funds.input_view.title', { asset: asset?.name })}
                </PWText>
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
                value={cryptoValue ? Decimal(cryptoValue) : Decimal(0)}
                style={[
                    cryptoValue ? styles.amount : styles.amountPlaceholder,
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
                <PWText style={styles.amountPlaceholder}>--</PWText>
            )}

            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={
                        note
                            ? t('send_funds.confirmation.edit')
                            : t('send_funds.add_note.button')
                    }
                    variant='secondary'
                    style={styles.secondaryButton}
                    onPress={noteState.open}
                />
                <PWButton
                    title={t('send_funds.input.max')}
                    variant='secondary'
                    style={styles.secondaryButton}
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
                isDisabled={!cryptoValue}
            />

            <AddNotePanel
                isVisible={noteState.isOpen}
                onClose={noteState.close}
            />
            <SendFundsInfoPanel
                isVisible={infoState.isOpen}
                onClose={infoState.close}
            />
        </PWView>
    )
}
