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

import { useLanguage } from '@hooks/useLanguage'
import type {
    LegacyWalletConnectV1Session,
    LegacyWalletConnectV2Session,
} from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    EmptyHint,
    InlineRow,
    SubBlock,
} from '../SettingsDeveloperMigrationViewerScreen'

export const WalletConnectV1Section = ({
    sessions,
}: {
    sessions: LegacyWalletConnectV1Session[]
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_wc_v1')}
            count={sessions.length}
        >
            {sessions.length === 0 ? (
                <EmptyHint />
            ) : (
                sessions.map((s, i) => (
                    <SubBlock
                        key={`${s.id}-${i}`}
                        title={`#${i} — ${s.peerMeta.name || s.id}`}
                    >
                        <InlineRow
                            label='id'
                            value={s.id}
                        />
                        <InlineRow
                            label='peerMeta.name'
                            value={s.peerMeta.name}
                        />
                        <InlineRow
                            label='peerMeta.url'
                            value={s.peerMeta.url}
                        />
                        <InlineRow
                            label='peerMeta.description'
                            value={s.peerMeta.description}
                        />
                        <InlineRow
                            label='peerMeta.icons'
                            value={s.peerMeta.icons}
                        />
                        <InlineRow
                            label='isConnected'
                            value={s.isConnected}
                        />
                        <InlineRow
                            label='isSubscribed'
                            value={s.isSubscribed}
                        />
                        <InlineRow
                            label='dateTimestampMs'
                            value={s.dateTimestampMs}
                        />
                        <InlineRow
                            label='fallbackBrowserGroupResponse'
                            value={s.fallbackBrowserGroupResponse}
                        />
                        <InlineRow
                            label='connectedAccounts'
                            value={s.connectedAccounts}
                        />
                        <InlineRow
                            label='sessionMetaJson'
                            value={s.sessionMetaJson}
                        />
                    </SubBlock>
                ))
            )}
        </CollapsibleSection>
    )
}

export const WalletConnectV2Section = ({
    sessions,
}: {
    sessions: LegacyWalletConnectV2Session[]
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_wc_v2')}
            count={sessions.length}
        >
            {sessions.length === 0 ? (
                <EmptyHint />
            ) : (
                sessions.map((s, i) => (
                    <SubBlock
                        key={`${s.topic}-${i}`}
                        title={`#${i}`}
                    >
                        <InlineRow
                            label='topic'
                            value={s.topic}
                        />
                        <InlineRow
                            label='dateTimestampMs'
                            value={s.dateTimestampMs}
                        />
                        <InlineRow
                            label='isSubscribed'
                            value={s.isSubscribed}
                        />
                        <InlineRow
                            label='fallbackBrowserGroupResponse'
                            value={s.fallbackBrowserGroupResponse}
                        />
                    </SubBlock>
                ))
            )}
        </CollapsibleSection>
    )
}
