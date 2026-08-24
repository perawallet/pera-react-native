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

import { PWButton } from '@components/core'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { decodeBytesToText } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useCallback, useMemo } from 'react'
import { KeyValueRow } from '@components/KeyValueRow'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ViewTextDetailsContent } from '../../ViewTextDetailsContent'

export const TransactionNoteRow = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

    const note = useMemo(
        () => decodeBytesToText(transaction.note),
        [transaction.note],
    )

    const handleOpen = useCallback(() => {
        if (!note) return
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

    if (!note) {
        return null
    }

    return (
        <KeyValueRow title={t('transactions.common.note')}>
            <PWButton
                variant='linkPositive'
                title={t('transactions.common.view_note')}
                onPress={handleOpen}
                paddingStyle='none'
            />
        </KeyValueRow>
    )
}
