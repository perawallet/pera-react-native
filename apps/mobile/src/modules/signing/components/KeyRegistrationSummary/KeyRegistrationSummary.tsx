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

import { useMemo } from 'react'
import { PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { getKeyRegType } from '@modules/transactions/components/transaction-details/KeyRegistrationDisplay/utils'
import { useStyles } from './styles'

export type KeyRegistrationSummaryProps = {
    transaction?: PeraDisplayableTransaction
}

/**
 * Online-vs-offline is the whole decision a key registration asks the user to
 * make, and the review surface showed only "Key Registration Transaction", the
 * account and the fee — everything that distinguishes going online from
 * de-registering sat one tap away behind the fee row.
 *
 * The participation keys themselves stay in Transaction Details: three base64
 * blobs (44/44/88 chars) would dominate the sheet, and the status plus the
 * validity window is what the user is actually being asked to approve.
 */
export const KeyRegistrationSummary = ({
    transaction,
}: KeyRegistrationSummaryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const keyReg = transaction?.keyregTransaction
    const keyRegType = useMemo(
        () => (transaction ? getKeyRegType(transaction) : undefined),
        [transaction],
    )

    if (!transaction || !keyRegType) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <KeyValueRow title={t('transactions.key_reg.status')}>
                <PWText>{t(`transactions.key_reg.${keyRegType}`)}</PWText>
            </KeyValueRow>

            {keyRegType === 'online' &&
                keyReg?.voteFirstValid !== undefined &&
                keyReg?.voteLastValid !== undefined && (
                    <KeyValueRow title={t('transactions.key_reg.valid_rounds')}>
                        <PWText>
                            {keyReg.voteFirstValid.toString()} -{' '}
                            {keyReg.voteLastValid.toString()}
                        </PWText>
                    </KeyValueRow>
                )}
        </PWView>
    )
}
