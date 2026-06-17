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

import { PWText, PWView } from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import type {
    MigrationResult,
    MigrationRunResult,
} from '@perawallet/wallet-core-migrate'
import { useStyles } from '../styles'
import { MigrationDataRow } from './MigrationDataRow'
import { StackedMigrationDataRow } from './StackedMigrationDataRow'

type ExtrasMigrationResult = NonNullable<MigrationRunResult['extras']>

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

const AccountsResultRows = ({ accounts }: { accounts: MigrationResult }) => (
    <>
        <MigrationDataRow
            label='Imported'
            value={accounts.imported}
        />
        <MigrationDataRow
            label='Skipped (already present)'
            value={accounts.skipped}
        />
        <MigrationDataRow
            label='Failed'
            value={accounts.failed.length}
        />
        {accounts.failed.map((f, i) => (
            <StackedMigrationDataRow
                key={`${f.address}-${i}`}
                label={`${f.name || truncateAlgorandAddress(f.address)}`}
                value={f.reason}
            />
        ))}
    </>
)

const ExtrasResultRows = ({ extras }: { extras: ExtrasMigrationResult }) => (
    <>
        <MigrationDataRow
            label='preferences'
            value={extras.preferences}
        />
        <MigrationDataRow
            label='swaps'
            value={extras.swaps}
        />
        <MigrationDataRow
            label='deviceIdentifiers'
            value={extras.deviceIdentifiers}
        />
        <MigrationDataRow
            label='contacts imported'
            value={extras.contacts.imported}
        />
        <MigrationDataRow
            label='contacts skipped'
            value={extras.contacts.skipped}
        />
        <MigrationDataRow
            label='notifications muted'
            value={extras.notifications.muted}
        />
        <MigrationDataRow
            label='pin migrated'
            value={extras.auth.pinMigrated}
        />
        <MigrationDataRow
            label='biometric migrated'
            value={extras.auth.biometricMigrated}
        />
        <MigrationDataRow
            label='lockout migrated'
            value={extras.auth.lockoutMigrated}
        />
        <MigrationDataRow
            label='passkeys imported'
            value={extras.passkeys.imported}
        />
        <MigrationDataRow
            label='passkeys skipped'
            value={extras.passkeys.skipped}
        />
        <MigrationDataRow
            label='wc history blob stashed'
            value={extras.stashed.walletConnectHistoryBlobStashed}
        />
        <MigrationDataRow
            label='extras steps failed'
            value={extras.failed.length}
        />
        {extras.failed.map((f, i) => (
            <StackedMigrationDataRow
                key={`${f.step}-${i}`}
                label={f.step}
                value={f.reason}
            />
        ))}
    </>
)
