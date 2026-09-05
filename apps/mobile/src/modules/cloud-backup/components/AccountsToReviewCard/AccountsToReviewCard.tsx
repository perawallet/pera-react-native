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

import {
    PWButton,
    PWIcon,
    PWText,
    PWView,
    type IconName,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type AccountsToReviewCardProps = {
    notBackedUpCount: number
    availableFromBackupCount: number
    onReview: () => void
}

type SummaryLineProps = {
    icon: IconName
    isNegative: boolean
    label: string
}

const SummaryLine = ({ icon, isNegative, label }: SummaryLineProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.summaryLine}>
            <PWIcon
                name={icon}
                size='sm'
                variant={isNegative ? 'error' : 'secondary'}
            />
            <PWText
                variant='body'
                style={styles.summaryText}
            >
                {label}
            </PWText>
        </PWView>
    )
}

export const AccountsToReviewCard = ({
    notBackedUpCount,
    availableFromBackupCount,
    onReview,
}: AccountsToReviewCardProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (notBackedUpCount === 0 && availableFromBackupCount === 0) return null

    return (
        <PWView
            style={styles.card}
            testID='accounts_to_review_card'
        >
            <PWView style={styles.glyph}>
                <PWIcon
                    name='shield-warning'
                    variant='warning'
                />
            </PWView>
            <PWView style={styles.content}>
                <PWView style={styles.textColumn}>
                    <PWText variant='h3'>
                        {t('cloud_backup.accounts.review_title')}
                    </PWText>
                    <PWView style={styles.summary}>
                        {notBackedUpCount > 0 && (
                            <SummaryLine
                                icon='cloud-off'
                                isNegative
                                label={t(
                                    'cloud_backup.accounts.not_backed_up_count',
                                    { count: notBackedUpCount },
                                )}
                            />
                        )}
                        {availableFromBackupCount > 0 && (
                            <SummaryLine
                                icon='cloud-download'
                                isNegative={false}
                                label={t(
                                    'cloud_backup.accounts.available_count',
                                    { count: availableFromBackupCount },
                                )}
                            />
                        )}
                    </PWView>
                </PWView>
                <PWButton
                    variant='primary'
                    title={t('cloud_backup.accounts.review_action')}
                    onPress={onReview}
                    style={styles.button}
                    testID='accounts_to_review_button'
                />
            </PWView>
        </PWView>
    )
}
