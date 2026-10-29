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

import type { MigrationRunResult } from '@perawallet/wallet-core-migrate'
import { MigrationDataRow } from '../MigrationDataRow'
import { StackedMigrationDataRow } from '../StackedMigrationDataRow'

type ExtrasMigrationResult = NonNullable<MigrationRunResult['extras']>

export type ExtrasResultRowsProps = { extras: ExtrasMigrationResult }

export const ExtrasResultRows = ({ extras }: ExtrasResultRowsProps) => (
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
