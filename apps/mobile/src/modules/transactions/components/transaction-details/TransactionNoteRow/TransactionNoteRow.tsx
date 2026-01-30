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

import { PWButton, PWView } from '@components/core'
import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useMemo } from 'react'
import { useStyles } from './styles'
import { useModalState } from '@hooks/useModalState'
import { KeyValueRow } from '@components/KeyValueRow'
import { ViewNotePanel } from '../../ViewNotePanel'

export const TransactionNoteRow = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const noteModal = useModalState()
    const note = useMemo(() => {
        return transaction.note
            ? Buffer.from(transaction.note).toString()
            : undefined
    }, [transaction.note])

    if (!note) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <KeyValueRow title={t('transactions.common.note')}>
                <PWButton
                    variant='link'
                    title={t('transactions.common.view_note')}
                    onPress={noteModal.open}
                    paddingStyle='none'
                />
            </KeyValueRow>
            <ViewNotePanel
                note={note}
                isVisible={noteModal.isOpen}
                onClose={noteModal.close}
            />
        </PWView>
    )
}
