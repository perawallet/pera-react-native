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

import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from '../styles'
import type { ResultRow } from '../useMigrationSimulatorStore'

type ResultLineProps = {
    row: ResultRow
}

export const ResultLine = ({ row }: ResultLineProps) => {
    const styles = useStyles()
    const { icon, iconVariant, detail } = describeOutcome(row.outcome)
    return (
        <PWView style={styles.resultRow}>
            <PWView style={styles.resultStatusIcon}>
                <PWIcon
                    name={icon}
                    size='sm'
                    variant={iconVariant}
                />
            </PWView>
            <PWText
                variant='body'
                style={styles.resultDbName}
            >
                {row.dbName}
            </PWText>
            <PWText
                variant='body'
                style={styles.resultDetail}
            >
                {detail}
            </PWText>
        </PWView>
    )
}

const describeOutcome = (
    outcome: ResultRow['outcome'],
): {
    icon: 'check' | 'cross' | 'info'
    iconVariant: 'positive' | 'error' | 'helper'
    detail: string
} => {
    switch (outcome.kind) {
        case 'pending':
            return { icon: 'info', iconVariant: 'helper', detail: 'Working…' }
        case 'success':
            return outcome.version === 0
                ? { icon: 'check', iconVariant: 'positive', detail: 'Reset' }
                : {
                      icon: 'check',
                      iconVariant: 'positive',
                      detail: `v${outcome.version}`,
                  }
        case 'done':
            return {
                icon: 'check',
                iconVariant: 'positive',
                detail: outcome.detail,
            }
        case 'error':
            return {
                icon: 'cross',
                iconVariant: 'error',
                detail: outcome.message,
            }
    }
}
