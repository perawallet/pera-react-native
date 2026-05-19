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

import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import {
    PWView,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWButton,
    PWFlatList,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem'
import { ALGO_ASSET, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import {
    useLedgerAccountInfoContent,
    type LedgerInfoListItem,
} from './useLedgerAccountInfoContent'
import { useStyles } from './styles'

export type LedgerAccountInfoContentProps = {
    address: string
    accountIndex: number
    title?: string
}

export const LedgerAccountInfoContent = ({
    address,
    accountIndex,
    title,
}: LedgerAccountInfoContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const {
        title: resolvedTitle,
        items,
        isLoading,
        isError,
        refetch,
    } = useLedgerAccountInfoContent(address, accountIndex, title)

    const renderItem = useCallback(
        ({ item }: { item: LedgerInfoListItem }) => {
            switch (item.kind) {
                case 'sectionHeader':
                    return (
                        <PWText
                            variant='h4'
                            style={styles.sectionHeader}
                        >
                            {item.title}
                        </PWText>
                    )

                case 'account':
                    return (
                        <PWView style={styles.accountRow}>
                            <AccountDisplay
                                account={item.account}
                                showChevron={false}
                                showAccountType
                            />
                            <PWView style={styles.balanceContainer}>
                                <CurrencyDisplay
                                    currency='ALGO'
                                    value={item.algoBalance}
                                    precision={ALGO_ASSET.decimals}
                                    minPrecision={2}
                                    variant='bodyCompact'
                                />
                                <PreferredCurrencyDisplay
                                    sourceAssetId={ALGO_ASSET_ID}
                                    sourceAmount={item.algoBalance}
                                    usdPrice={item.algoUsdPrice}
                                    precision={2}
                                    minPrecision={2}
                                    variant='bodyCompact'
                                    style={styles.fiatBalance}
                                />
                            </PWView>
                        </PWView>
                    )

                case 'asset':
                    return (
                        <AccountAssetItemView
                            accountBalance={item.accountBalance}
                            usdPrice={item.usdPrice}
                        />
                    )

                case 'rekeyAddress':
                    return (
                        <AccountDisplay
                            account={item.account}
                            showChevron={false}
                            showAccountType
                            style={styles.rekeyRow}
                        />
                    )
            }
        },
        [styles],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableIcon
                        name='cross'
                        onPress={dismiss}
                        testID='ledger_account_info_close'
                    />
                }
                center={<PWText variant='h3'>{resolvedTitle}</PWText>}
            />

            {isLoading && (
                <PWView
                    style={styles.centerState}
                    testID='ledger_account_info_loading'
                >
                    <ActivityIndicator />
                </PWView>
            )}

            {isError && !isLoading && (
                <PWView
                    style={styles.centerState}
                    testID='ledger_account_info_error'
                >
                    <PWText
                        variant='body'
                        style={styles.secondary}
                    >
                        {t('ledger.account_info.error')}
                    </PWText>
                    <PWButton
                        variant='secondary'
                        title={t('ledger.account_info.retry')}
                        onPress={refetch}
                        testID='ledger_account_info_retry'
                    />
                </PWView>
            )}

            {!isLoading && !isError && (
                <PWFlatList
                    inBottomSheet
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item: LedgerInfoListItem) => item.key}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    testID='ledger_account_info_list'
                />
            )}
        </PWView>
    )
}
