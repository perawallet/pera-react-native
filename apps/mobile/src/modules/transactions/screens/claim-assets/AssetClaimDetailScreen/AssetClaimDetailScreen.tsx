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
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    DEFAULT_PRECISION,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { RejectConfirmBottomSheet } from '@modules/transactions/components/claim-assets/RejectConfirmBottomSheet'
import { useStyles } from './styles'
import { useAssetClaimDetailScreen } from './useAssetClaimDetailScreen'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import Decimal from 'decimal.js'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'

export const AssetClaimDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        request,
        amount,
        receiverAccount,
        isRejectSheetOpen,
        handleClaim,
        handleRejectPress,
        handleRejectConfirm,
        handleRejectClose,
        handleCopyAssetId,
    } = useAssetClaimDetailScreen()

    if (!request) return null

    return (
        <PWView style={styles.container}>
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.amountSection}>
                    <CurrencyDisplay
                        variant='h2'
                        value={amount}
                        currency={request.asset?.unitName ?? ''}
                        precision={request.asset?.decimals}
                        minPrecision={DEFAULT_PRECISION}
                    />
                    <PreferredCurrencyDisplay
                        sourceAmount={amount}
                        sourceAssetId={request.asset?.assetId}
                        precision={DEFAULT_PRECISION}
                        showSymbol
                        style={styles.usdText}
                    />
                    <PWView style={styles.assetIdRow}>
                        <PWText
                            variant='caption'
                            style={styles.usdText}
                        >
                            {request.asset?.assetId}
                        </PWText>
                        <PWTouchableOpacity
                            style={styles.copyIdPill}
                            onPress={handleCopyAssetId}
                        >
                            <PWText variant='caption'>
                                {t('messages.claim.copy_id')}
                            </PWText>
                        </PWTouchableOpacity>
                    </PWView>
                </PWView>

                <PWDivider style={styles.separator} />

                <PWView style={styles.accountRow}>
                    <PWText style={styles.headerLabelText}>
                        {t('messages.claim.account')}
                    </PWText>
                    {receiverAccount && (
                        <AccountDisplay account={receiverAccount} />
                    )}
                </PWView>

                <PWDivider style={styles.separator} />

                <PWView style={styles.sendersSection}>
                    <PWView style={styles.sendersHeader}>
                        <PWText style={styles.headerLabelText}>
                            {t('messages.claim.senders')}
                        </PWText>
                        <PWText style={styles.headerLabelText}>
                            {t('messages.claim.amount')}
                        </PWText>
                    </PWView>
                    {request.senders.results.map((senderItem, index) => (
                        <PWView
                            key={`${senderItem.sender.address}-${index}`}
                            style={styles.senderRow}
                        >
                            <AddressDisplay
                                address={senderItem.sender.address}
                            />
                            <CurrencyDisplay
                                value={Decimal(senderItem.amount)}
                                currency={request.asset?.unitName ?? ''}
                                precision={request.asset?.decimals}
                                minPrecision={DEFAULT_PRECISION}
                                prefix={'+'}
                                style={styles.senderAmountText}
                            />
                        </PWView>
                    ))}
                </PWView>
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWView style={styles.rejectButton}>
                    <PWButton
                        variant='secondary'
                        title={t('messages.claim.reject')}
                        onPress={handleRejectPress}
                    />
                </PWView>
                <PWView style={styles.claimButton}>
                    <PWButton
                        variant='primary'
                        title={t('messages.claim.claim')}
                        onPress={handleClaim}
                    />
                </PWView>
            </PWView>

            <RejectConfirmBottomSheet
                isOpen={isRejectSheetOpen}
                onClose={handleRejectClose}
                onConfirm={handleRejectConfirm}
                algoRefundAmount={request.algoGainOnReject}
            />
        </PWView>
    )
}
