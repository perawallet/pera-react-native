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

import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { LegacyVsRnRow } from '../components/LegacyVsRnRow'
import { EmptyDataHint } from '../components/EmptyDataHint'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'
import { AccountCard } from './AccountCard'

export const AccountsSection = ({
    accounts,
    rn,
}: {
    accounts: LegacyAccount[]
    rn: RNMigrationSnapshot
}) => {
    return (
        <MigrationDataSection
            title='Accounts'
            count={accounts.length}
        >
            <LegacyVsRnRow
                label='count'
                legacyValue={accounts.length}
                rnValue={rn.accountsByAddress.size}
                matches={accounts.length === rn.accountsByAddress.size}
            />
            {accounts.length === 0 ? (
                <EmptyDataHint />
            ) : (
                accounts.map((account, i) => (
                    <AccountCard
                        key={`${account.address}-${i}`}
                        account={account}
                        rn={rn}
                    />
                ))
            )}
        </MigrationDataSection>
    )
}
