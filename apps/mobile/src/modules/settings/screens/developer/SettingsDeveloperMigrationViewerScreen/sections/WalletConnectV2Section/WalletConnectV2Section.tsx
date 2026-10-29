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

import type { LegacyWalletConnectV2Session } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../../components/MigrationDataSection'
import { EmptyDataHint } from '../../components/EmptyDataHint'
import { MigrationDataRow } from '../../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../../components/MigrationDataSubBlock'

export type WalletConnectV2SectionProps = {
    sessions: LegacyWalletConnectV2Session[]
}

export const WalletConnectV2Section = ({
    sessions,
}: WalletConnectV2SectionProps) => {
    return (
        <MigrationDataSection
            title='WalletConnect v2'
            count={sessions.length}
        >
            {sessions.length === 0 ? (
                <EmptyDataHint />
            ) : (
                sessions.map((s, i) => (
                    <MigrationDataSubBlock
                        key={`${s.topic}-${i}`}
                        title={`#${i}`}
                    >
                        <MigrationDataRow
                            label='topic'
                            value={s.topic}
                        />
                        <MigrationDataRow
                            label='dateTimestampMs'
                            value={s.dateTimestampMs}
                        />
                        <MigrationDataRow
                            label='isSubscribed'
                            value={s.isSubscribed}
                        />
                        <MigrationDataRow
                            label='fallbackBrowserGroupResponse'
                            value={s.fallbackBrowserGroupResponse}
                        />
                    </MigrationDataSubBlock>
                ))
            )}
        </MigrationDataSection>
    )
}
