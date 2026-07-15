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

import type {
    LegacyWalletConnectV1Session,
    LegacyWalletConnectV2Session,
} from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../components/MigrationDataSubBlock'

export const WalletConnectV1Section = ({
    sessions,
}: {
    sessions: LegacyWalletConnectV1Session[]
}) => {
    return (
        <MigrationDataSection
            title='WalletConnect v1'
            count={sessions.length}
        >
            {sessions.length === 0 ? (
                <EmptyDataHint />
            ) : (
                sessions.map((s, i) => (
                    <MigrationDataSubBlock
                        key={`${s.id}-${i}`}
                        title={`#${i} — ${s.peerMeta.name || s.id}`}
                    >
                        <MigrationDataRow
                            label='id'
                            value={s.id}
                        />
                        <MigrationDataRow
                            label='peerMeta.name'
                            value={s.peerMeta.name}
                        />
                        <MigrationDataRow
                            label='peerMeta.url'
                            value={s.peerMeta.url}
                        />
                        <MigrationDataRow
                            label='peerMeta.description'
                            value={s.peerMeta.description}
                        />
                        <MigrationDataRow
                            label='peerMeta.icons'
                            value={s.peerMeta.icons}
                        />
                        <MigrationDataRow
                            label='isConnected'
                            value={s.isConnected}
                        />
                        <MigrationDataRow
                            label='isSubscribed'
                            value={s.isSubscribed}
                        />
                        <MigrationDataRow
                            label='dateTimestampMs'
                            value={s.dateTimestampMs}
                        />
                        <MigrationDataRow
                            label='fallbackBrowserGroupResponse'
                            value={s.fallbackBrowserGroupResponse}
                        />
                        <MigrationDataRow
                            label='connectedAccounts'
                            value={s.connectedAccounts}
                        />
                        <MigrationDataRow
                            label='sessionMetaJson'
                            value={s.sessionMetaJson}
                        />
                        <MigrationDataRow
                            label='clientId'
                            value={s.clientId}
                        />
                        <MigrationDataRow
                            label='peerId'
                            value={s.peerId}
                        />
                        <MigrationDataRow
                            label='handshakeId'
                            value={s.handshakeId}
                        />
                        <MigrationDataRow
                            label='currentKey'
                            value={s.currentKey}
                        />
                        <MigrationDataRow
                            label='approvedAccounts'
                            value={s.approvedAccounts}
                        />
                        <MigrationDataRow
                            label='chainId'
                            value={s.chainId}
                        />
                    </MigrationDataSubBlock>
                ))
            )}
        </MigrationDataSection>
    )
}

export const WalletConnectV2Section = ({
    sessions,
}: {
    sessions: LegacyWalletConnectV2Session[]
}) => {
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
