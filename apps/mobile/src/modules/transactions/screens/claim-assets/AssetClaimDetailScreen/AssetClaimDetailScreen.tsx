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
    PWSlideToConfirm,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { AssetIcon, AssetNameBadge } from '@modules/assets/components'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAssetClaimDetailScreen } from './useAssetClaimDetailScreen'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { AddressDisplay } from '@components/AddressDisplay'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import { isCollectible } from '@perawallet/wallet-core-assets'
import { EmptyView } from '@components/EmptyView'

export const AssetClaimDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        request,
        amount,
        receiverAccount,
        handleClaim,
        handleRejectPress,
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
        <PWScreen
            footer={
                <>
                    {!request.microAlgoGainOnClaim.isZero() && (
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
                        <PWSlideToConfirm
                            title={t('common.slide_to_confirm.label')}
                            onConfirm={handleClaim}
                            testID='arc59_claim_confirm_slide'
                        />
                        <PWButton
                            variant='linkNeutral'
                            title={t('arc59.claim.reject')}
                            onPress={handleRejectPress}
                        />
                    </PWView>
                </>
            }
        >
            <PWView style={styles.amountSection}>
                <PWView
                    style={styles.assetPreview}
                    testID='arc59_claim_asset_preview'
                >
                    <AssetIcon
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
