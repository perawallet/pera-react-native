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

import { useMemo } from 'react'
import {
    algorandSafeJsonStringify,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    bottomSheetNotifier,
    PWIcon,
    PWSheetLayout,
    PWText,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'

export type RawTransactionContentProps = {
    transaction: PeraDisplayableTransaction
}

export const RawTransactionContent = ({
    transaction,
}: RawTransactionContentProps) => {
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const rawText = useMemo(() => {
        return algorandSafeJsonStringify(transaction.rawTransaction)
    }, [transaction.rawTransaction])

    const copyText = () => {
        void copyToClipboard(rawText, bottomSheetNotifier.current ?? undefined)
    }

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('transactions.common.raw_transaction')}
                    rightAction={
                        <PWIcon
                            name='copy'
                            variant='secondary'
                            onPress={copyText}
                        />
                    }
                />
            }
        >
            <PWText variant='mono'>{rawText}</PWText>
        </PWSheetLayout>
    )
}
