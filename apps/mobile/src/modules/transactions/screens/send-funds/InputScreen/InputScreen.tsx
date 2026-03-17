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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import Decimal from 'decimal.js'

import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { useStyles } from './styles'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { NumberPad } from '@components/NumberPad'
import { useSendFunds } from '@modules/transactions/hooks'
import { AddNotePanel } from '../../../components/send-funds/AddNotePanel'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { SendFundsInfoPanel } from '../../../components/send-funds/SendFundsInfoPanel/SendFundsInfoPanel'
import { InsufficientBalancePanel } from '../../../components/send-funds/InsufficientBalancePanel'
import { CloseAccountPanel } from '../../../components/send-funds/CloseAccountPanel'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { LoadingView } from '@components/LoadingView'
import { useInputScreen } from './useInputScreen'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useCallback } from 'react'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

export const InputScreen = () => {
    const styles = useStyles()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const {
        asset,
        accountAssetBalance,
        params,
        accountInformation,
        cryptoValue,
        setMax,
        handleKey,
        handleNext,
        handleContinuePastMbr,
        isMaxExceeded,
        dismissMaxExceeded,
        minBalanceDisplay,
        isCloseAccountEligible,
        dismissCloseAccount,
        handleConfirmCloseAccount,
    } = useInputScreen()
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

    useNavigationHeader({
        left: (
            <PWIcon
                name={canSelectAsset ? 'chevron-left' : 'cross'}
                onPress={handleBack}
            />
        ),
        right: (
            <PWIcon
                name='info'
                onPress={infoState.open}
            />
        ),
        title: (
            <PWView style={styles.headerTitleContainer}>
                <PWText>
                    {t('send_funds.input_view.title', {
                        asset: asset?.name,
                    })}
                </PWText>
                <AccountDisplay
                    account={selectedAccount ?? undefined}
                    style={styles.accountDisplay}
                    iconProps={{ width: 16, height: 16 }}
                    textProps={{
                        style: styles.accountDisplaySubHeading,
                    }}
                    showChevron={false}
                    compact
                />
            </PWView>
        ),
    })

    if (!asset || !accountAssetBalance || !params || !accountInformation) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.mainContentContainer}>
                <CurrencyDisplay
                    currency={asset.unitName ?? ''}
                    precision={asset.decimals}
                    value={cryptoValue ? Decimal(cryptoValue) : Decimal(0)}
                    rawValue={cryptoValue ?? undefined}
                    ignorePrivacyMode
                    style={[
                        cryptoValue ? styles.amount : styles.amountPlaceholder,
                        styles.h1,
                    ]} //h1Style doesn't seem to override fontfamily
                    showSymbol={false}
                    minPrecision={2}
                />
                <PreferredCurrencyDisplay
                    sourceAmount={cryptoValue ? Decimal(cryptoValue) : null}
                    ignorePrivacyMode
                    sourceAssetId={accountAssetBalance?.assetId ?? ''}
                    precision={6}
                    showSymbol
                    minPrecision={2}
                    style={styles.amountPlaceholder}
                />

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
            </PWView>

            <AccountAssetItemView
                accountBalance={accountAssetBalance}
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
            <CloseAccountPanel
                isVisible={isCloseAccountEligible}
                onClose={dismissCloseAccount}
                onConfirm={handleConfirmCloseAccount}
            />
        </PWView>
    )
}
