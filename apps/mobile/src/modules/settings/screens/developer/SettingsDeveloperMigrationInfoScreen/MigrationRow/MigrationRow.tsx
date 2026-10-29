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
import type { BundledMigrationSummary } from '@perawallet/wallet-extension-platform'
import { useStyles } from './styles'

export type MigrationRowProps = {
    migration: BundledMigrationSummary
}

export const MigrationRow = ({ migration }: MigrationRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.migrationRow}>
            <PWText
                variant='body'
                style={styles.migrationStep}
            >
                {`${migration.from} → ${migration.to}`}
            </PWText>
            <PWText
                variant='body'
                style={styles.migrationDescription}
            >
                {migration.description}
            </PWText>
        </PWView>
    )
}
