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
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ConfirmAction, CONFIRM_ACTION_LAYOUT } from '@components/ConfirmAction'
import { CopyableText } from '@components/CopyableText'
import { AssetIcon } from '@components/AssetIcon'
import { AssetNameBadge } from '@modules/assets'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAssetClaimDetailScreen } from './useAssetClaimDetailScreen'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { AddressDisplay } from '@components/AddressDisplay'
import { AccountDisplay } from '@components/AccountDisplay'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import { isCollectible } from '@perawallet/wallet-core-assets'
import { EmptyView } from '@components/EmptyView'
import { InfoCallout } from '@components/InfoCallout'

export const AssetClaimDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        request,
        chainId,
        amount,
        nativeSymbol,
        claimGainLabel,
        receiverAccount,
        isClaimBlocked,
        isRejectBlocked,
        handleClaim,
        canBuy,
        handleAddFunds,
        handleRejectPress,
        handleCopyAssetId,
    } = useAssetClaimDetailScreen()

    if (!request) {
        return (
            <EmptyView
                title={t('asset_inbox.requests.empty_title')}
                body={t('asset_inbox.requests.empty_body')}
            />
        )
    }

    return (
        <PWScreen
            footer={
                <>
                    {claimGainLabel && (
                        <>
                            <PWDivider style={styles.separator} />
                            <PWView style={styles.nativeGainRow}>
                                <PWIcon
                                    name='info'
                                    variant='secondary'
                                    style={styles.nativeGainIcon}
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.nativeGainText}
                                >
                                    {t('asset_inbox.claim.native_gain', {
                                        amount: claimGainLabel,
                                    })}
                                </PWText>
                            </PWView>
                        </>
                    )}
                    {(isClaimBlocked || isRejectBlocked) && (
                        <PWView style={styles.insufficientCallout}>
                            <InfoCallout
                                icon='warning'
                                iconVariant='error'
                                iconSize='sm'
                                titleVariant='bodySemibold'
                                title={t(
                                    'messages.claim.insufficient_native_title',
                                    { symbol: nativeSymbol },
                                )}
                                body={t(
                                    isClaimBlocked
                                        ? 'messages.claim.insufficient_native_claim'
                                        : 'messages.claim.insufficient_native_reject',
                                    { symbol: nativeSymbol },
                                )}
                                testID='asset_inbox_claim_insufficient_funds'
                            />
                            {canBuy && (
                                <PWButton
                                    variant='secondary'
                                    title={t(
                                        'messages.claim.insufficient_native_cta',
                                    )}
                                    onPress={handleAddFunds}
                                    style={styles.addFundsButton}
                                    testID='asset_inbox_claim_add_funds'
                                />
                            )}
                        </PWView>
                    )}
                    <PWView style={[styles.footer, CONFIRM_ACTION_LAYOUT]}>
                        <ConfirmAction
                            title={t('common.slide_to_confirm.label')}
                            onConfirm={handleClaim}
                            isDisabled={isClaimBlocked}
                            testID='asset_inbox_claim_confirm_slide'
                        />
                        <PWButton
                            variant='linkNeutral'
                            title={t('asset_inbox.claim.reject')}
                            onPress={handleRejectPress}
                            isDisabled={isRejectBlocked}
                        />
                    </PWView>
                </>
            }
        >
            <PWView style={styles.amountSection}>
                <PWView
                    style={styles.assetPreview}
                    testID='asset_inbox_claim_asset_preview'
                >
                    <AssetIcon
                        chainId={chainId}
                        asset={request.asset}
                        size='3xl'
                        shape={
                            isCollectible(request.asset) ? 'square' : 'circle'
                        }
                    />
                </PWView>
                <AssetNameBadge
                    name={request.asset.name ?? ''}
                    verificationTier={
                        request.asset.peraMetadata?.verificationTier
                    }
                />
                <AssetAmount
                    chainId={chainId}
                    variant='h2'
                    value={amount}
                    asset={request.asset}
                />
                <PreferredAmount
                    sourceAmount={amount}
                    sourceAssetId={request.asset?.assetId}
                    showSymbol
                    style={styles.usdText}
                    usdPrice={request.usdValue ?? undefined}
                />
            </PWView>

            {request.id && (
                <>
                    <PWView style={styles.assetIdRow}>
                        <CopyableText copyValue={request.id}>
                            <PWText style={styles.usdText}>{request.id}</PWText>
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
                        <AssetAmount
                            chainId={chainId}
                            value={baseUnitsToDisplayUnits(
                                senderItem.amount,
                                request.asset.decimals,
                            )}
                            asset={request.asset}
                            prefix={'+'}
                            style={styles.senderAmountText}
                        />
                    </PWView>
                ))}
            </PWView>
        </PWScreen>
    )
}
