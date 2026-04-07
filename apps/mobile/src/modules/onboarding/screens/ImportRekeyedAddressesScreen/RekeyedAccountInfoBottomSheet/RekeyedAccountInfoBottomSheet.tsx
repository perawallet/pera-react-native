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

import React from 'react'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWRoundIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { useLanguage } from '@hooks/useLanguage'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { useRekeyedAccountInfoBottomSheet } from './useRekeyedAccountInfoBottomSheet'
import { useStyles } from './styles'

export type RekeyedAccountInfoBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    account: WalletAccount
}

export const RekeyedAccountInfoBottomSheet = ({
    isVisible,
    onClose,
    account,
}: RekeyedAccountInfoBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { displayName: accountDisplayName } = useResolvedAddress(
        account.address,
    )
    const {
        rekeyedAccountBalances,
        rekeyedAccountAlgoValue,
        authAddress,
        authAccountAlgoValue,
    } = useRekeyedAccountInfoBottomSheet({ account, isVisible })

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            size='lg'
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>{accountDisplayName}</PWText>}
                paddingStyle='dense'
            />

            <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                    testID='section-account-details'
                >
                    {t(
                        'onboarding.import_rekeyed_addresses.info_sheet.account_details',
                    )}
                </PWText>

                <PWView style={styles.accountRow}>
                    <PWRoundIcon
                        icon='account-rekeyed'
                        variant='helper'
                        size='md'
                    />
                    <PWView style={styles.accountTextContainer}>
                        <CopyableText copyValue={account.address}>
                            <PWText
                                variant='body'
                                numberOfLines={1}
                                ellipsizeMode='middle'
                            >
                                {account.address}
                            </PWText>
                        </CopyableText>
                        <PWText
                            variant='caption'
                            style={styles.accountSubtitle}
                        >
                            {t(
                                'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
                            )}
                        </PWText>
                    </PWView>
                    <PWView style={styles.balanceContainer}>
                        <CurrencyDisplay
                            currency='ALGO'
                            value={rekeyedAccountAlgoValue}
                            precision={6}
                            minPrecision={2}
                            showSymbol
                        />
                        <PreferredCurrencyDisplay
                            sourceAmount={rekeyedAccountAlgoValue}
                            sourceAssetId={ALGO_ASSET_ID}
                            precision={2}
                            minPrecision={2}
                            showSymbol
                            style={styles.secondaryBalance}
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.divider} />

                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                    testID='section-assets'
                >
                    {t('onboarding.import_rekeyed_addresses.info_sheet.assets')}
                </PWText>

                {rekeyedAccountBalances.map(balance => (
                    <AccountAssetItemView
                        key={balance.assetId}
                        accountBalance={balance}
                        style={styles.assetItem}
                    />
                ))}

                {!!authAddress && (
                    <>
                        <PWView style={styles.divider} />

                        <PWText
                            variant='body'
                            style={styles.sectionTitle}
                            testID='section-can-be-signed-by'
                        >
                            {t(
                                'onboarding.import_rekeyed_addresses.info_sheet.can_be_signed_by',
                            )}
                        </PWText>

                        <PWView style={styles.accountRow}>
                            <PWRoundIcon
                                icon='wallet'
                                variant='helper'
                                size='md'
                            />
                            <PWView style={styles.accountTextContainer}>
                                <CopyableText copyValue={authAddress}>
                                    <PWText
                                        variant='body'
                                        numberOfLines={1}
                                        ellipsizeMode='middle'
                                    >
                                        {authAddress}
                                    </PWText>
                                </CopyableText>
                            </PWView>
                            <PWView style={styles.balanceContainer}>
                                <CurrencyDisplay
                                    currency='ALGO'
                                    value={authAccountAlgoValue}
                                    precision={6}
                                    minPrecision={2}
                                    showSymbol
                                />
                                <PreferredCurrencyDisplay
                                    sourceAmount={authAccountAlgoValue}
                                    sourceAssetId={ALGO_ASSET_ID}
                                    precision={2}
                                    minPrecision={2}
                                    showSymbol
                                    style={styles.secondaryBalance}
                                />
                            </PWView>
                        </PWView>
                    </>
                )}

                <PWButton
                    variant='secondary'
                    title={t('common.close.label')}
                    onPress={onClose}
                    style={styles.closeButton}
                    testID='close-button'
                />
            </BottomSheetScrollView>
        </PWBottomSheet>
    )
}
