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
import type { MigrationRunResult } from '@perawallet/wallet-core-migrate'
import { useStyles } from '../styles'
import { MigrationDataRow } from './MigrationDataRow'
import { StackedMigrationDataRow } from './StackedMigrationDataRow'
import { AccountsResultRows } from './AccountsResultRows'
import { ExtrasResultRows } from './ExtrasResultRows'

type MigrationRunResultBannerProps = {
    result: MigrationRunResult | null
    error: Error | null
}

export const MigrationRunResultBanner = ({
    result,
    error,
}: MigrationRunResultBannerProps) => {
    const styles = useStyles()

    if (error) {
        return (
            <PWView style={styles.statusBanner}>
                <PWText
                    variant='h4'
                    style={styles.statusBannerTitle}
                >
                    Migration error
                </PWText>
                <PWText>{error.message}</PWText>
            </PWView>
        )
    }

    if (!result) return null

    return (
        <PWView style={styles.statusBanner}>
            <PWText
                variant='h4'
                style={styles.statusBannerTitle}
            >
                Migration result
            </PWText>
            <MigrationDataRow
                label='completed'
                value={result.completed}
            />
            {result.incompleteReason && (
                <MigrationDataRow
                    label='incompleteReason'
                    value={result.incompleteReason}
                />
            )}
            {result.error && (
                <StackedMigrationDataRow
                    label='error'
                    value={result.error.message}
                />
            )}
            {result.accounts && (
                <AccountsResultRows accounts={result.accounts} />
            )}
            {result.extras && <ExtrasResultRows extras={result.extras} />}
        </PWView>
    )
}
