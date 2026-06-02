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
import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    EmptyHint,
    InlineRow,
    SubBlock,
} from '../SettingsDeveloperMigrationViewerScreen'

export const PasskeysSection = ({
    passkeys,
}: {
    passkeys: LegacyPasskey[]
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_passkeys')}
            count={passkeys.length}
        >
            {passkeys.length === 0 ? (
                <EmptyHint />
            ) : (
                passkeys.map((p, i) => (
                    <SubBlock
                        key={`${p.credentialId}-${i}`}
                        title={`#${i} — ${p.siteName ?? p.siteUrl}`}
                    >
                        <InlineRow
                            label='credentialId'
                            value={p.credentialId}
                        />
                        <InlineRow
                            label='address'
                            value={p.address}
                        />
                        <InlineRow
                            label='siteUrl'
                            value={p.siteUrl}
                        />
                        <InlineRow
                            label='siteName'
                            value={p.siteName}
                        />
                        <InlineRow
                            label='userName'
                            value={p.userName}
                        />
                        <InlineRow
                            label='userDisplayName'
                            value={p.userDisplayName}
                        />
                        <InlineRow
                            label='userHandle'
                            value={p.userHandle}
                        />
                        <InlineRow
                            label='lastUsedAtMs'
                            value={p.lastUsedAtMs}
                        />
                    </SubBlock>
                ))
            )}
        </CollapsibleSection>
    )
}
