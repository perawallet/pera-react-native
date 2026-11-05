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

import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '../../TransactionDetailCard'
import type { TransactionDetailSummary } from '../../types'
import { TransactionDetailAddressRow } from './TransactionDetailAddressRow'
import { TransactionDetailFeeRow } from './TransactionDetailFeeRow'
import { TransactionDetailNoteRow } from './TransactionDetailNoteRow'

type TransactionDetailPartiesCardProps = {
    summary: TransactionDetailSummary
}

export const TransactionDetailPartiesCard = ({
    summary,
}: TransactionDetailPartiesCardProps) => {
    const { t } = useLanguage()
    const { scope, from, to, fee, note } = summary

    if (!from && !to && !fee && !note) {
        return null
    }

    return (
        <TransactionDetailCard testID='transaction_detail_parties'>
            {!!from && (
                <TransactionDetailAddressRow
                    testID='transaction_detail_from'
                    title={t('transactions.common.from')}
                    address={from}
                    scope={scope}
                />
            )}
            {!!to && (
                <TransactionDetailAddressRow
                    testID='transaction_detail_to'
                    title={t('transactions.common.to')}
                    address={to}
                    scope={scope}
                />
            )}
            {!!fee && (
                <TransactionDetailFeeRow
                    fee={fee}
                    scope={scope}
                />
            )}
            {!!note && <TransactionDetailNoteRow note={note} />}
        </TransactionDetailCard>
    )
}
