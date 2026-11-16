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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewDetailRow } from '../ReviewDetailRow'
import { useStyles } from './styles'
import type { ReactNode } from 'react'

export type ReviewFeeRowProps = {
    /** The fee the transaction is expected to pay. */
    expected: ReactNode
    /** The most it can pay, and in what; unset when the fee is fixed. */
    maximum?: ReactNode
    labelAccessory?: ReactNode
    testID?: string
}

export const ReviewFeeRow = ({
    expected,
    maximum,
    labelAccessory,
    testID = 'review_network_fee',
}: ReviewFeeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <ReviewDetailRow
            label={t('signing.review.network_fee')}
            labelAccessory={labelAccessory}
            testID={testID}
        >
            <PWView style={styles.value}>
                {expected}
                {!!maximum && (
                    <PWText
                        variant='caption'
                        style={styles.maximum}
                    >
                        {maximum}
                    </PWText>
                )}
            </PWView>
        </ReviewDetailRow>
    )
}
