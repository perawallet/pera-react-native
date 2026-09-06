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
import { useStyles } from './styles'

export type BackupReviewLine = {
    icon: IconName
    isNegative: boolean
    label: string
}

export type BackupReviewCardProps = {
    title: string
    /** Callers drop zero-count lines; an empty list renders no card. */
    lines: BackupReviewLine[]
    actionLabel: string
    onReview: () => void
    testID: string
}

const SummaryLine = ({ icon, isNegative, label }: BackupReviewLine) => {
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

export const BackupReviewCard = ({
    title,
    lines,
    actionLabel,
    onReview,
    testID,
}: BackupReviewCardProps) => {
    const styles = useStyles()

    if (lines.length === 0) return null

    return (
        <PWView
            style={styles.card}
            testID={testID}
        >
            <PWView style={styles.glyph}>
                <PWIcon
                    name='shield-warning'
                    variant='warning'
                />
            </PWView>
            <PWView style={styles.content}>
                <PWView style={styles.textColumn}>
                    <PWText variant='h3'>{title}</PWText>
                    <PWView style={styles.summary}>
                        {lines.map(line => (
                            <SummaryLine
                                key={line.icon}
                                {...line}
                            />
                        ))}
                    </PWView>
                </PWView>
                <PWButton
                    variant='primary'
                    title={actionLabel}
                    onPress={onReview}
                    style={styles.button}
                    testID={`${testID}_button`}
                />
            </PWView>
        </PWView>
    )
}
