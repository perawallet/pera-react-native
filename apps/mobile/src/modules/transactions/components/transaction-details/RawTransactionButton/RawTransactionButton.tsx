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

import {
    algorandSafeJsonStringify,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    bottomSheetNotifier,
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
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

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
        copyToClipboard(rawText, bottomSheetNotifier.current ?? undefined)
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
            <PWBottomSheet
                containerStyle={styles.contentContainer}
                isVisible={modalState.isOpen}
                size='lg'
                autoCreateContainer={false}
            >
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
                    paddingStyle='dense'
                />
                <BottomSheetScrollView
                    contentContainerStyle={styles.scrollview}
                    scrollEnabled
                >
                    <PWText variant='mono'>{rawText}</PWText>
                </BottomSheetScrollView>
            </PWBottomSheet>
        </>
    )
}
