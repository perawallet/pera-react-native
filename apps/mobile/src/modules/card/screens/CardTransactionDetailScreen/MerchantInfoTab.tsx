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

import type { CardTransaction } from '@perawallet/wallet-core-card'
import { PWScrollView, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    getCardMccCategoryLabelKey,
    getCardMerchantTypeLabelKey,
} from '../../utils/cardTransactions'
import { DetailRow } from './DetailRow'
import { useStyles } from './styles'

type MerchantInfoTabProps = {
    transaction: CardTransaction
}

// Baanx exposes no structured merchant address (city/country) — only the
// name/location string plus MCC metadata, so that's what the tab shows.
export const MerchantInfoTab = ({ transaction }: MerchantInfoTabProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const merchantName = transaction.merchantName?.trim()

    // Wire values ("FOOD", "OutOfWalletOnline") map to friendly labels;
    // unmapped values fall back to the raw string rather than an empty row.
    const rawCategory = transaction.mccCategory?.trim()
    const categoryKey = rawCategory && getCardMccCategoryLabelKey(rawCategory)
    const category = categoryKey ? t(categoryKey) : rawCategory

    const rawMerchantType = transaction.merchantType?.trim()
    const merchantTypeKey =
        rawMerchantType && getCardMerchantTypeLabelKey(rawMerchantType)
    const merchantType = merchantTypeKey ? t(merchantTypeKey) : rawMerchantType

    return (
        <PWScrollView
            style={styles.tabContent}
            showsVerticalScrollIndicator={false}
        >
            {merchantName ? (
                <PWText
                    variant='h4'
                    style={styles.merchantHeading}
                    testID='card_transaction_detail_merchant_name'
                >
                    {merchantName}
                </PWText>
            ) : null}
            {category ? (
                <DetailRow
                    title={t('peraCard.transactions.detail_merchant_category')}
                    testID='card_transaction_detail_merchant_category'
                >
                    <PWText variant='body'>{category}</PWText>
                </DetailRow>
            ) : null}
            {merchantType ? (
                <DetailRow
                    title={t('peraCard.transactions.detail_merchant_type')}
                >
                    <PWText variant='body'>{merchantType}</PWText>
                </DetailRow>
            ) : null}
        </PWScrollView>
    )
}
