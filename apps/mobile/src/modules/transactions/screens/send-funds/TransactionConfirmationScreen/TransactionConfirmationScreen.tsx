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

import {
    PWButton,
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'

import { KeyValueRow } from '@components/KeyValueRow'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import Decimal from 'decimal.js'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'
import { AddNotePanel } from '../../../components/send-funds/AddNotePanel'
import { ALGO_ASSET, toWholeUnits } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { LoadingView } from '@components/LoadingView'
import { useTransactionConfirmationScreen } from './useTransactionConfirmationScreen'
import { CloseAccountWarning } from './CloseAccountWarning'

export const TransactionConfirmationScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        asset,
        amount,
        destination,
        selectedAccount,
        selectedAssetId,
        params,
        paramsPending,
        currentBalance,
        currentBalancePending,
        note,
        noteOpen,
        openNote,
        closeNote,
        handleConfirm,
        isReady,
        isCloseAccount,
    } = useTransactionConfirmationScreen()

    if (!isReady) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWView style={styles.container}>
            <KeyValueRow title={t('send_funds.confirmation.amount')}>
                <CurrencyDisplay
                    variant='h3'
                    currency={asset?.unitName ?? ''}
                    precision={asset?.decimals ?? DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    showSymbol
                    value={amount ?? Decimal(0)}
                />
                <PreferredCurrencyDisplay
                    style={styles.secondaryAmount}
                    sourceAmount={amount}
                    sourceAssetId={selectedAssetId ?? ''}
                    precision={asset?.decimals ?? DEFAULT_PRECISION}
                    minPrecision={DEFAULT_PRECISION}
                    showSymbol
                />
            </KeyValueRow>
            <PWDivider />
            {!!selectedAccount && (
                <KeyValueRow title={t('send_funds.confirmation.account')}>
                    <AccountDisplay
                        account={selectedAccount}
                        showChevron={false}
                    />
                </KeyValueRow>
            )}
            {!!destination && (
                <KeyValueRow title={t('send_funds.confirmation.to')}>
                    <AddressDisplay
                        address={destination}
                        showCopy={false}
                    />
                </KeyValueRow>
            )}
            <KeyValueRow title={t('send_funds.confirmation.fee')}>
                <CurrencyDisplay
                    currency='ALGO'
                    precision={ALGO_ASSET.decimals}
                    minPrecision={DEFAULT_PRECISION}
                    showSymbol
                    value={
                        params?.minFee != null
                            ? toWholeUnits(params.minFee, ALGO_ASSET)
                            : null
                    }
                    isLoading={paramsPending}
                />
            </KeyValueRow>
            <PWDivider />
            {currentBalance && (
                <KeyValueRow
                    title={t('send_funds.confirmation.current_balance')}
                >
                    <CurrencyDisplay
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        showSymbol
                        value={currentBalance.amount}
                        isLoading={currentBalancePending}
                    />
                    <PreferredCurrencyDisplay
                        sourceAmount={currentBalance.amount}
                        sourceAssetId={selectedAssetId ?? ''}
                        precision={asset?.decimals ?? DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        showSymbol
                        style={styles.secondaryAmount}
                    />
                </KeyValueRow>
            )}
            <PWDivider />
            <KeyValueRow title={t('send_funds.confirmation.note')}>
                {!!note && <PWText>{note}</PWText>}
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
                        <PWText style={styles.link}>
                            {t('send_funds.confirmation.edit')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
                {!note && (
                    <PWTouchableOpacity>
                        <PWText
                            style={styles.link}
                            onPress={openNote}
                        >
                            {t('send_funds.add_note.button')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </KeyValueRow>
            <PWView style={styles.buttonContainer}>
                {isCloseAccount && <CloseAccountWarning />}
                <PWButton
                    title={t('send_funds.confirmation.confirm_button')}
                    variant='primary'
                    testID='send_confirm_button'
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
