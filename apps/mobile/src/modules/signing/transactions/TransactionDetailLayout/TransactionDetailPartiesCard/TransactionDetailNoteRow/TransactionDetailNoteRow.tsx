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

import { useCallback } from 'react'
import { PWButton } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { ViewTextDetailsContent } from '@components/ViewTextDetailsContent'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'

type TransactionDetailNoteRowProps = {
    note: string
}

export const TransactionDetailNoteRow = ({
    note,
}: TransactionDetailNoteRowProps) => {
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpen = useCallback(() => {
        void requestBottomSheet({
            contents: (
                <ViewTextDetailsContent
                    title={t('transactions.common.note')}
                    text={note}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, note, t])

    return (
        <KeyValueRow
            testID='transaction_detail_note'
            title={t('transactions.common.note')}
        >
            <PWButton
                variant='linkPositive'
                title={t('transactions.common.view_note')}
                onPress={handleOpen}
                paddingStyle='none'
            />
        </KeyValueRow>
    )
}
