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

import { Fragment } from 'react'
import { useTheme } from '@rneui/themed'
import { PWDivider, PWText, PWView } from '@components/core'
import { CheckboxRow } from '@components/CheckboxRow'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewWarningText } from './ReviewWarningText'
import { useStyles } from './styles'
import type { ReviewWarningItem } from './types'
import { useReviewWarningsBanner } from './useReviewWarningsBanner'

export type ReviewWarningsBannerProps = {
    items: readonly ReviewWarningItem[]
}

export const ReviewWarningsBanner = ({ items }: ReviewWarningsBannerProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const { isCollapsible, hasHighRisk, isAcknowledged, toggleAcknowledged } =
        useReviewWarningsBanner(items)
    const styles = useStyles({ hasHighRisk })

    if (items.length === 0) {
        return null
    }

    const rows = items.map((item, index) => (
        <Fragment key={item.id}>
            {index > 0 && <PWDivider color={theme.colors.layerGray} />}
            <PWView
                style={styles.row}
                testID={item.id}
            >
                {!!item.title && (
                    <PWText
                        variant='bodySemibold'
                        style={styles.title}
                    >
                        {item.title}
                    </PWText>
                )}
                {typeof item.message === 'string' ? (
                    <ReviewWarningText>{item.message}</ReviewWarningText>
                ) : (
                    item.message
                )}
            </PWView>
        </Fragment>
    ))

    return (
        <PWView
            style={styles.container}
            testID='review_warnings'
        >
            {isCollapsible ? (
                <TitledExpandablePanel
                    // startExpanded only applies on mount; remount when a high-risk item arrives.
                    key={String(hasHighRisk)}
                    hasVerticalChevron
                    startExpanded={hasHighRisk}
                    headerStyle={styles.panelHeader}
                    testID='review_warnings_toggle'
                    title={
                        <PWView style={styles.summaryContainer}>
                            <PWText
                                variant='bodySemibold'
                                style={styles.title}
                                testID='review_warnings_summary'
                            >
                                {t('signing.review_warnings.summary', {
                                    count: items.length,
                                })}
                            </PWText>
                        </PWView>
                    }
                >
                    <PWView style={styles.foldedRows}>{rows}</PWView>
                </TitledExpandablePanel>
            ) : (
                <PWView style={styles.rows}>{rows}</PWView>
            )}
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
