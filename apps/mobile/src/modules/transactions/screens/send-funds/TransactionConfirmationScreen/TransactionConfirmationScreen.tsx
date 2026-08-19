/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    PWDivider,
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'

import { KeyValueRow } from '@components/KeyValueRow'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { Decimal } from 'decimal.js'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { QuantumFeeExplainer } from '@modules/transactions/components/QuantumFeeExplainer'
import { AddressDisplay } from '@components/AddressDisplay'
import { useStyles } from './styles'
import { ALGO_ASSET, toWholeUnits } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { LoadingView } from '@components/LoadingView'
import { useTransactionConfirmationScreen } from './useTransactionConfirmationScreen'
import { CloseAccountWarning } from './CloseAccountWarning'
import { RecipientBelowMbrWarning } from '../RecipientBelowMbrWarning/RecipientBelowMbrWarning'

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
        isQuantumFee,
        currentBalance,
        currentBalancePending,
        note,
        openNote,
        handleConfirm,
        isCollectible,
        isReady,
        isCloseAccount,
        isRecipientBelowMbr,
        recipientMbrDisplay,
        isRecipientInfoPending,
        isSigning,
    } = useTransactionConfirmationScreen()

    if (!isReady) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            footer={
                <>
                    {isCloseAccount && <CloseAccountWarning />}
                    {isRecipientBelowMbr && (
                        <RecipientBelowMbrWarning
                            minBalance={recipientMbrDisplay}
                        />
                    )}
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleConfirm}
                        isLoading={isRecipientInfoPending || isSigning}
                        isDisabled={
                            isRecipientBelowMbr || isRecipientInfoPending
                        }
                        testID='send_confirm_button'
                    />
                </>
            }
        >
            <PWView style={styles.scrollContent}>
                <KeyValueRow title={t('send_funds.confirmation.amount')}>
                    <AssetAmount
                        variant='h3'
                        asset={asset}
                        showSymbol
                        ignorePrivacyMode
                        value={amount ?? new Decimal(0)}
                    />
                    {!isCollectible && (
                        <PreferredAmount
                            style={styles.secondaryAmount}
                            sourceAmount={amount}
                            sourceAssetId={selectedAssetId ?? ''}
                            showSymbol
                            ignorePrivacyMode
                        />
                    )}
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
                    <PWView style={styles.feeValueContainer}>
                        <AssetAmount
                            asset={ALGO_ASSET}
                            showSymbol
                            ignorePrivacyMode
                            value={
                                params?.minFee != null
                                    ? toWholeUnits(params.minFee, ALGO_ASSET)
                                    : null
                            }
                            isLoading={paramsPending}
                        />
                        {isQuantumFee && <QuantumFeeExplainer />}
                    </PWView>
                </KeyValueRow>
                <PWDivider />
                {currentBalance && (
                    <KeyValueRow
                        title={t('send_funds.confirmation.current_balance')}
                    >
                        <AssetAmount
                            asset={asset}
                            showSymbol
                            value={currentBalance.amount}
                            isLoading={currentBalancePending}
                        />
                        {!isCollectible && (
                            <PreferredAmount
                                sourceAmount={currentBalance.amount}
                                sourceAssetId={selectedAssetId ?? ''}
                                showSymbol
                                style={styles.secondaryAmount}
                            />
                        )}
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
                        <PWTouchableOpacity onPress={openNote}>
                            <PWText style={styles.link}>
                                {t('send_funds.add_note.button')}
                            </PWText>
                        </PWTouchableOpacity>
                    )}
                </KeyValueRow>
            </PWView>
        </PWScreen>
    )
}
