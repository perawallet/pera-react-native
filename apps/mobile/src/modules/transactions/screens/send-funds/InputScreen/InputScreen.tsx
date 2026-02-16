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

import { PWButton, PWHeader, PWText, PWView } from '@components/core'
import Decimal from 'decimal.js'

import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useStyles } from './styles'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { NumberPad } from '@components/NumberPad'
import { useSendFunds } from '@modules/transactions/hooks'
import { AddNotePanel } from '../../../components/send-funds/AddNotePanel'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { SendFundsInfoPanel } from '../../../components/send-funds/SendFundsInfoPanel/SendFundsInfoPanel'
import { InsufficientBalancePanel } from '../../../components/send-funds/InsufficientBalancePanel'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { LoadingView } from '@components/LoadingView'
import { useInputScreen } from './useInputScreen'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useCallback } from 'react'

export const InputScreen = () => {
    const styles = useStyles()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
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
        handleContinuePastMbr,
        isMaxExceeded,
        dismissMaxExceeded,
        minBalanceDisplay,
    } = useInputScreen()
    const { preferredFiatCurrency } = useCurrency()
    const selectedAccount = useSelectedAccount()
    const { canSelectAsset, note, onFinished } = useSendFunds()
    const { t } = useLanguage()
    const noteState = useModalState()
    const infoState = useModalState()

    const handleBack = useCallback(() => {
        if (canSelectAsset) {
            navigation.navigate('AssetSelection')
        } else {
            onFinished?.()
        }
    }, [canSelectAsset, navigation, onFinished])

    if (!asset || !selectedAsset || !params || !accountInformation) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon={!canSelectAsset ? 'chevron-left' : 'cross'}
                onLeftPress={handleBack}
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
                    compact
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
                    currency={preferredFiatCurrency}
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
            <InsufficientBalancePanel
                isVisible={isMaxExceeded}
                onClose={dismissMaxExceeded}
                onContinue={handleContinuePastMbr}
                minBalance={minBalanceDisplay}
            />
        </PWView>
    )
}
