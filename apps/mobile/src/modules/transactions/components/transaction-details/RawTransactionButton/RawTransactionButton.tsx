import {
    algorandSafeJsonStringify,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useStyles } from './styles'
import { useClipboard } from '@hooks/useClipboard'
import { useMemo } from 'react'

type RawTransactionButtonProps = {
    transaction: PeraDisplayableTransaction
}

export const RawTransactionButton = ({
    transaction,
}: RawTransactionButtonProps) => {
    const { t } = useLanguage()
    const modalState = useModalState()
    const styles = useStyles()
    const { copyToClipboard } = useClipboard()

    const rawText = useMemo(() => {
        return algorandSafeJsonStringify(transaction.rawTransaction)
    }, [transaction.rawTransaction])

    const copyText = () => {
        copyToClipboard(rawText)
    }

    if (!transaction.rawTransaction || !!transaction.id) {
        return null
    }

    return (
        <>
            <PWButton
                variant='secondary'
                title={t('transactions.common.view_raw_transaction')}
                iconRight='code'
                onPress={modalState.open}
                paddingStyle='dense'
                rounded
            />
            <PWBottomSheet isVisible={modalState.isOpen}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            variant='secondary'
                            onPress={modalState.close}
                        />
                    }
                    center={
                        <PWText variant='h4'>
                            {t('transactions.common.raw_transaction')}
                        </PWText>
                    }
                    right={
                        <PWIcon
                            name='copy'
                            variant='secondary'
                            onPress={copyText}
                        />
                    }
                />
                <PWText
                    variant='body'
                    style={styles.rawTransactionText}
                >
                    {rawText}
                </PWText>
            </PWBottomSheet>
        </>
    )
}
