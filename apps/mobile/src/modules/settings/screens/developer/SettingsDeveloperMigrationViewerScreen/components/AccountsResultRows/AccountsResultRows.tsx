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

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import type { MigrationResult } from '@perawallet/wallet-core-migrate'
import { MigrationDataRow } from '../MigrationDataRow'
import { StackedMigrationDataRow } from '../StackedMigrationDataRow'

export type AccountsResultRowsProps = { accounts: MigrationResult }

export const AccountsResultRows = ({ accounts }: AccountsResultRowsProps) => (
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
