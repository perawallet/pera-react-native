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
import { useStyles } from '../styles'
import { formatDebugValue } from '../utils/formatDebugValue'

type StackedMigrationDataRowProps = { label: string; value: unknown }

export const StackedMigrationDataRow = ({
    label,
    value,
}: StackedMigrationDataRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.stackedRow}>
            <PWText
                variant='body'
                style={styles.stackedRowLabel}
            >
                {label}
            </PWText>
            <PWText
                variant='body'
                style={[styles.stackedRowValue, styles.monospaceValue]}
            >
                {formatDebugValue(value)}
            </PWText>
        </PWView>
    )
}
