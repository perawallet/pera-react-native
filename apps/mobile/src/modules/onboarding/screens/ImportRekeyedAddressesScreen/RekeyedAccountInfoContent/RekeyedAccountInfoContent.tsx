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

import React from 'react'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWRoundIcon,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { useLanguage } from '@hooks/useLanguage'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useRekeyedAccountInfoContent } from './useRekeyedAccountInfoContent'
import { useStyles } from './styles'

export type RekeyedAccountInfoContentProps = {
    account: WalletAccount
}

export const RekeyedAccountInfoContent = ({
    account,
}: RekeyedAccountInfoContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const { displayName: accountDisplayName } = useResolvedAddress(
        account.address,
    )
    const {
        rekeyedAccountBalances,
        rekeyedAccountAlgoValue,
        authAddress,
        authAccountAlgoValue,
    } = useRekeyedAccountInfoContent({ account })

    return (
        <PWSheetLayout header={<SheetHeader title={accountDisplayName} />}>
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
                            truncate
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
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={rekeyedAccountAlgoValue}
                        showSymbol
                    />
                    <PreferredAmount
                        sourceAmount={rekeyedAccountAlgoValue}
                        sourceAssetId={ALGO_ASSET_ID}
                        density='compact'
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
                                    truncate
                                    ellipsizeMode='middle'
                                >
                                    {authAddress}
                                </PWText>
                            </CopyableText>
                        </PWView>
                        <PWView style={styles.balanceContainer}>
                            <AssetAmount
                                asset={ALGO_ASSET}
                                value={authAccountAlgoValue}
                                showSymbol
                            />
                            <PreferredAmount
                                sourceAmount={authAccountAlgoValue}
                                sourceAssetId={ALGO_ASSET_ID}
                                density='compact'
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
                onPress={dismiss}
                style={styles.closeButton}
                testID='close-button'
            />
        </PWSheetLayout>
    )
}
