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

import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type CardStepStatus = 'pending' | 'active' | 'done' | 'failed'

type CardStepRowProps = {
    stepNumber: number
    label: string
    status: CardStepStatus
    /** The step's work is in flight; a spinner replaces the number. */
    isBusy?: boolean
    testID?: string
}

/** One row of a multi-step card flow: numbered circle + label. */
export const CardStepRow = ({
    stepNumber,
    label,
    status,
    isBusy = false,
    testID,
}: CardStepRowProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const isPending = status === 'pending'
    const isFailed = status === 'failed'

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <PWView
                style={[
                    styles.bullet,
                    isFailed
                        ? styles.bulletFailed
                        : isPending
                          ? styles.bulletPending
                          : styles.bulletFilled,
                ]}
            >
                {status === 'done' ? (
                    <PWIcon
                        name='check'
                        size='xs'
                        variant='positive'
                    />
                ) : isFailed ? (
                    <PWIcon
                        name='cross'
                        size='xs'
                        variant='negative'
                        testID={testID ? `${testID}-failed` : undefined}
                    />
                ) : isBusy ? (
                    <ActivityIndicator
                        size='small'
                        color={theme.colors.positive}
                        testID={testID ? `${testID}-spinner` : undefined}
                    />
                ) : (
                    <PWText
                        variant='bodyLarge'
                        style={
                            isPending
                                ? styles.bulletNumberPending
                                : styles.bulletNumberActive
                        }
                    >
                        {stepNumber}
                    </PWText>
                )}
            </PWView>
            <PWText
                variant='bodyLarge'
                style={[
                    styles.rowLabel,
                    isPending ? styles.labelPending : styles.labelActive,
                ]}
            >
                {label}
            </PWText>
        </PWView>
    )
}
