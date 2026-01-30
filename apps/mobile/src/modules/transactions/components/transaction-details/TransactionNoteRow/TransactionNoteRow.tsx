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
