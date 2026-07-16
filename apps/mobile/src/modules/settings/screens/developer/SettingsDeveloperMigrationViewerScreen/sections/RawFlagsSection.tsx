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

import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'

export const RawFlagsSection = ({
    rawFlags,
}: {
    rawFlags: LegacyPreferences['rawFlags']
}) => {
    const entries = Object.entries(rawFlags)
    return (
        <MigrationDataSection
            title='Raw Flags'
            count={entries.length}
        >
            {entries.length === 0 ? (
                <EmptyDataHint />
            ) : (
                entries.map(([key, value]) => (
                    <MigrationDataRow
                        key={key}
                        label={key}
                        value={value}
                    />
                ))
            )}
        </MigrationDataSection>
    )
}
