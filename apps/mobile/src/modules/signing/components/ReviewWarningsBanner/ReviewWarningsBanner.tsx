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

import { PWView } from '@components/core'
import { CheckboxRow } from '@components/CheckboxRow'
import { useLanguage } from '@hooks/useLanguage'
import { CautionCard } from '../CautionCard'
import { ReviewWarningText } from './ReviewWarningText'
import { useStyles } from './styles'
import type { ReviewWarningItem } from './types'
import { useReviewWarningsBanner } from './useReviewWarningsBanner'

export type ReviewWarningsBannerProps = {
    items: readonly ReviewWarningItem[]
}

/** The review's cautions, one card each, most serious first. */
export const ReviewWarningsBanner = ({ items }: ReviewWarningsBannerProps) => {
    const { t } = useLanguage()
    const { hasHighRisk, isAcknowledged, toggleAcknowledged } =
        useReviewWarningsBanner(items)
    const styles = useStyles()

    if (items.length === 0) {
        return null
    }

    return (
        <PWView
            style={styles.container}
            testID='review_warnings'
        >
            {items.map(item => (
                <CautionCard
                    key={item.id}
                    testID={item.id}
                    title={item.title}
                    isHighRisk={item.isHighRisk}
                    message={
                        typeof item.message === 'string' ? (
                            <ReviewWarningText>
                                {item.message}
                            </ReviewWarningText>
                        ) : (
                            item.message
                        )
                    }
                />
            ))}
            {hasHighRisk && (
                <CheckboxRow
                    label={t('signing.review_warnings.acknowledge')}
                    isChecked={isAcknowledged}
                    onToggle={toggleAcknowledged}
                    testID='review_warnings_acknowledge'
                />
            )}
        </PWView>
    )
}
