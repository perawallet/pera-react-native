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
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    PWView,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWButton,
    PWFlatList,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import {
    useLedgerAccountInfoContent,
    type LedgerInfoListItem,
} from './useLedgerAccountInfoContent'
import {
    LedgerSectionHeaderRow,
    LedgerAccountDetailsRow,
    LedgerAssetRow,
    LedgerRekeyAddressRow,
} from './LedgerAccountInfoRows'
import { useStyles } from './styles'

export type LedgerAccountInfoContentProps = {
    address: string
    accountIndex: number
}

export const LedgerAccountInfoContent = ({
    address,
    accountIndex,
}: LedgerAccountInfoContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const { preferredCurrency } = useCurrency()
    const { title, items, isLoading, isError, refetch } =
        useLedgerAccountInfoContent(address, accountIndex)

    const renderItem = useCallback(({ item }: { item: LedgerInfoListItem }) => {
        switch (item.kind) {
            case 'sectionHeader':
                return <LedgerSectionHeaderRow title={item.title} />
            case 'account':
                return (
                    <LedgerAccountDetailsRow
                        address={item.address}
                        algoBalance={item.algoBalance}
                        fiatValue={item.fiatValue}
                        label={t('ledger.account_info.ledger_account_label')}
                        preferredCurrency={preferredCurrency}
                    />
                )
            case 'asset':
                return (
                    <LedgerAssetRow
                        asset={item.asset}
                        preferredCurrency={preferredCurrency}
                    />
                )
            case 'rekeyAddress':
                return <LedgerRekeyAddressRow address={item.address} />
        }
    }, [t, preferredCurrency])

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
                center={<PWText variant='h3'>{title}</PWText>}
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
