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

import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../components/MigrationDataSubBlock'

export const PasskeysSection = ({
    passkeys,
}: {
    passkeys: LegacyPasskey[]
}) => {
    return (
        <MigrationDataSection
            title='Passkeys'
            count={passkeys.length}
        >
            {passkeys.length === 0 ? (
                <EmptyDataHint />
            ) : (
                passkeys.map((p, i) => (
                    <MigrationDataSubBlock
                        key={`${p.credentialId}-${i}`}
                        title={`#${i} — ${p.siteName ?? p.siteUrl}`}
                    >
                        <MigrationDataRow
                            label='credentialId'
                            value={p.credentialId}
                        />
                        <MigrationDataRow
                            label='address'
                            value={p.address}
                        />
                        <MigrationDataRow
                            label='siteUrl'
                            value={p.siteUrl}
                        />
                        <MigrationDataRow
                            label='siteName'
                            value={p.siteName}
                        />
                        <MigrationDataRow
                            label='userName'
                            value={p.userName}
                        />
                        <MigrationDataRow
                            label='userDisplayName'
                            value={p.userDisplayName}
                        />
                        <MigrationDataRow
                            label='userHandle'
                            value={p.userHandle}
                        />
                        <MigrationDataRow
                            label='lastUsedAtMs'
                            value={p.lastUsedAtMs}
                        />
                    </MigrationDataSubBlock>
                ))
            )}
        </MigrationDataSection>
    )
}
