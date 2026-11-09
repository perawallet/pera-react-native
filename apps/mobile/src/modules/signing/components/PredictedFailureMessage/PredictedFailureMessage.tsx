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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWView } from '@components/core'
import { ExpandableText } from '@components/ExpandableText'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewWarningText } from '../ReviewWarningsBanner'
import { useStyles } from './styles'

// Past this the reason folds behind "show more": it is the contract's own
// text, so its length is the contract's choice.
const REASON_PREVIEW_LENGTH = 120

export type PredictedFailureMessageProps = {
    /** The contract's own revert text; null when it gave none. */
    reason: Nullable<string>
}

export const PredictedFailureMessage = ({
    reason,
}: PredictedFailureMessageProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <ReviewWarningText testID='predicted_failure_body'>
                {t('signing.predicted_failure.body')}
            </ReviewWarningText>
            {!!reason && (
                <ExpandableText
                    text={t('signing.predicted_failure.reason', { reason })}
                    limit={REASON_PREVIEW_LENGTH}
                    textStyle={styles.reason}
                />
            )}
        </PWView>
    )
}
