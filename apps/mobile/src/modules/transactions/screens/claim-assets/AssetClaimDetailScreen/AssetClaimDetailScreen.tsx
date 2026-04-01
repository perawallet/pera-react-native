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
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useLanguage } from '@hooks/useLanguage'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { RejectConfirmBottomSheet } from '@modules/transactions/components/claim-assets/RejectConfirmBottomSheet'
import { useStyles } from './styles'
import { useAssetClaimDetailScreen } from './useAssetClaimDetailScreen'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyView } from '@components/EmptyView'

export const AssetClaimDetailScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
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

    if (!request) {
        return (
            <EmptyView
                title={t('arc59.requests.empty_title')}
                body={t('arc59.requests.empty_body')}
            />
        )
    }

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
                </PWView>

                {request.id && (
                    <>
                        <PWView style={styles.assetIdRow}>
                            <CopyableText copyValue={request.id}>
                                <PWText style={styles.usdText}>
                                    {request.id}
                                </PWText>
                            </CopyableText>
                            <PWTouchableOpacity
                                style={styles.copyIdPill}
                                onPress={handleCopyAssetId}
                            >
                                <PWText variant='caption'>
                                    {t('messages.claim.copy_id')}
                                </PWText>
                            </PWTouchableOpacity>
                        </PWView>

                        <PWDivider style={styles.separator} />
                    </>
                )}

                <PWView style={styles.accountRow}>
                    <PWText style={styles.headerLabelText}>
                        {t('messages.claim.account')}
                    </PWText>
                    {receiverAccount && (
                        <AccountDisplay
                            account={receiverAccount}
                            showChevron={false}
                        />
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
                                showCopy={false}
                            />
                            <CurrencyDisplay
                                value={baseUnitsToDisplayUnits(
                                    senderItem.amount,
                                    request.asset.decimals,
                                )}
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

            {!request.microAlgoGainOnClaim.equals(5) && (
                <>
                    <PWDivider style={styles.separator} />
                    <PWView style={styles.algoGainRow}>
                        <PWIcon
                            name='info'
                            variant='secondary'
                            style={styles.algoGainIcon}
                        />
                        <PWText
                            variant='caption'
                            style={styles.algoGainText}
                        >
                            {t('arc59.claim.algo_gain', {
                                amount: baseUnitsToDisplayUnits(
                                    request.microAlgoGainOnClaim,
                                    6,
                                ),
                            })}
                        </PWText>
                    </PWView>
                </>
            )}

            <PWView style={styles.footer}>
                <PWView style={styles.rejectButton}>
                    <PWButton
                        variant='secondary'
                        title={t('arc59.claim.reject')}
                        onPress={handleRejectPress}
                    />
                </PWView>
                <PWView style={styles.claimButton}>
                    <PWButton
                        variant='primary'
                        title={t('arc59.claim.claim')}
                        onPress={handleClaim}
                    />
                </PWView>
            </PWView>

            <RejectConfirmBottomSheet
                isOpen={isRejectSheetOpen}
                onClose={handleRejectClose}
                onConfirm={handleRejectConfirm}
                microAlgoRefundAmount={request.microAlgoGainOnReject}
            />
        </PWView>
    )
}
