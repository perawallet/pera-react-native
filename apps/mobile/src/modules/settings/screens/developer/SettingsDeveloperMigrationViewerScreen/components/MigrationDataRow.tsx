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
import {
    formatDebugValue,
    shouldUseStackedLayout,
} from '../utils/formatDebugValue'
import { StackedMigrationDataRow } from './StackedMigrationDataRow'

type MigrationDataRowProps = { label: string; value: unknown }

export const MigrationDataRow = ({ label, value }: MigrationDataRowProps) => {
    if (shouldUseStackedLayout(value)) {
        return (
            <StackedMigrationDataRow
                label={label}
                value={value}
            />
        )
    }
    return (
        <MigrationDataRowImpl
            label={label}
            value={value}
        />
    )
}

const MigrationDataRowImpl = ({ label, value }: MigrationDataRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.inlineRow}>
            <PWText
                variant='body'
                style={styles.inlineRowLabel}
            >
                {label}
            </PWText>
            <PWText
                variant='body'
                style={styles.inlineRowValue}
                numberOfLines={1}
                ellipsizeMode='middle'
            >
                {formatDebugValue(value)}
            </PWText>
        </PWView>
    )
}
