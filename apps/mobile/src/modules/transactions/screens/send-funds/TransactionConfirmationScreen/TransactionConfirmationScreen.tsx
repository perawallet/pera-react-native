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
    PWButton,
    PWDivider,
    PWScreen,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ConfirmAction, CONFIRM_ACTION_LAYOUT } from '@components/ConfirmAction'

import { KeyValueRow } from '@components/KeyValueRow'
import { AssetAmount } from '@components/AssetAmount'
import { AssetIcon } from '@components/AssetIcon'
import { PreferredAmount } from '@components/PreferredAmount'
import { Decimal } from 'decimal.js'
import { AccountDisplay } from '@components/AccountDisplay'
import { QuantumFeeExplainer } from '@modules/transactions/components/QuantumFeeExplainer'
import { AddressDisplay } from '@components/AddressDisplay'
import { InfoCallout } from '@components/InfoCallout'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ChainChip } from '@modules/chain-ui/icon'
import { LoadingView } from '@components/LoadingView'
import { useTransactionConfirmationScreen } from './useTransactionConfirmationScreen'
import { CloseAccountWarning } from './CloseAccountWarning'
import { SendTotalRow } from './SendTotalRow'
import { RecipientWarning } from '../RecipientWarning/RecipientWarning'
import { RecipientSafetyNotice } from '../RecipientSafetyNotice'
import { useSaveRecipientContact } from './useSaveRecipientContact'

export const TransactionConfirmationScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        asset,
        amount,
        destination,
        selectedAccount,
        selectedAssetId,
        scope,
        title,
        feeAmount,
        feePresets,
        isFeePending,
        feePreset,
        setFeePreset,
        isQuantumFee,
        currentBalance,
        currentBalancePending,
        note,
        FeeSection,
        TrailingSection,
        openNote,
        openRecipientAddress,
        handleConfirm,
        isCollectible,
        isReady,
        isCloseAccount,
        recipientWarning,
        isRecipientInfoPending,
        recipientSafety,
        isSigning,
        total,
        feeShortfall,
        isFeeCoveragePending,
    } = useTransactionConfirmationScreen()
    const { canSaveRecipient, saveRecipient } = useSaveRecipientContact(
        destination,
        scope,
        isSigning,
    )

    useNavigationHeader({ title })

    if (!isReady) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            footer={
                <PWView style={CONFIRM_ACTION_LAYOUT}>
                    {isCloseAccount && <CloseAccountWarning />}
                    {recipientWarning && (
                        <RecipientWarning notice={recipientWarning} />
                    )}
                    {!!destination && (
                        <RecipientSafetyNotice
                            assessment={recipientSafety.assessment}
                            isChecking={recipientSafety.isPending}
                            recipient={destination}
                            scope={scope}
                            isAcknowledged={recipientSafety.isAcknowledged}
                            onToggleAcknowledged={
                                recipientSafety.toggleAcknowledged
                            }
                        />
                    )}
                    {feeShortfall && (
                        <InfoCallout
                            title={feeShortfall.title}
                            body={feeShortfall.body}
                            icon='error-circle'
                            iconVariant='error'
                            testID='send_fee_shortfall'
                        />
                    )}
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleConfirm}
                        isLoading={isSigning}
                        isDisabled={
                            !!recipientWarning ||
                            isRecipientInfoPending ||
                            recipientSafety.isConfirmBlocked ||
                            isFeeCoveragePending ||
                            !!feeShortfall
                        }
                        testID='send_confirm_button'
                    />
                </PWView>
            }
        >
            <PWView style={styles.scrollContent}>
                <KeyValueRow title={t('send_funds.confirmation.amount')}>
                    <PWView style={styles.amountRow}>
                        {!!asset && (
                            <AssetIcon
                                asset={asset}
                                chainId={scope.chainId}
                                size='md'
                                shape={isCollectible ? 'square' : 'circle'}
                            />
                        )}
                        <PWView style={styles.amount}>
                            <AssetAmount
                                chainId={scope.chainId}
                                variant='h3'
                                asset={asset}
                                showSymbol
                                ignorePrivacyMode
                                value={amount ?? new Decimal(0)}
                                testID='send_confirm_amount'
                            />
                        </PWView>
                    </PWView>
                    {!isCollectible && (
                        <PreferredAmount
                            style={styles.secondaryAmount}
                            sourceAmount={amount}
                            sourceAssetId={selectedAssetId ?? ''}
                            scope={scope}
                            showSymbol
                            ignorePrivacyMode
                        />
                    )}
                    <ChainChip
                        chainId={scope.chainId}
                        style={styles.networkChip}
                        testID='send_confirm_network'
                    />
                </KeyValueRow>
                <PWDivider />
                {!!selectedAccount && (
                    <KeyValueRow title={t('send_funds.confirmation.account')}>
                        <AccountDisplay
                            account={selectedAccount}
                            chainId={scope.chainId}
                            showChevron={false}
                            showChainBadge
                        />
                    </KeyValueRow>
                )}
                {!!destination && (
                    <KeyValueRow title={t('send_funds.confirmation.to')}>
                        <PWTouchableOpacity
                            onPress={openRecipientAddress}
                            accessibilityRole='button'
                            accessibilityHint={t(
                                'send_funds.confirmation.view_full_address',
                            )}
                            testID='send_confirm_recipient'
                        >
                            <AddressDisplay
                                address={destination}
                                scope={scope}
                                forceShowIcon
                                showChainBadge
                                unnamedAddressFormat='full'
                                showCopy={false}
                            />
                        </PWTouchableOpacity>
                        {canSaveRecipient ? (
                            <PWButton
                                variant='linkPositive'
                                title={t(
                                    'send_funds.confirmation.add_to_contacts',
                                )}
                                paddingStyle='none'
                                onPress={saveRecipient}
                                style={styles.addContact}
                                testID='send_save_recipient_contact_button'
                            />
                        ) : null}
                    </KeyValueRow>
                )}
                <FeeSection
                    scope={scope}
                    amount={feeAmount}
                    presets={feePresets}
                    isLoading={isFeePending}
                    selectedPreset={feePreset}
                    onPresetChange={setFeePreset}
                    accessory={
                        isQuantumFee ? <QuantumFeeExplainer /> : undefined
                    }
                />
                {total && (
                    <SendTotalRow
                        total={total}
                        chainId={scope.chainId}
                    />
                )}
                <PWDivider />
                {currentBalance && (
                    <KeyValueRow
                        title={t('send_funds.confirmation.current_balance')}
                    >
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={asset}
                            showSymbol
                            value={currentBalance.amount}
                            isLoading={currentBalancePending}
                        />
                        {!isCollectible && (
                            <PreferredAmount
                                sourceAmount={currentBalance.amount}
                                sourceAssetId={selectedAssetId ?? ''}
                                scope={scope}
                                showSymbol
                                style={styles.secondaryAmount}
                            />
                        )}
                    </KeyValueRow>
                )}
                {TrailingSection && (
                    <TrailingSection
                        note={note}
                        onEditNote={openNote}
                    />
                )}
            </PWView>
        </PWScreen>
    )
}
