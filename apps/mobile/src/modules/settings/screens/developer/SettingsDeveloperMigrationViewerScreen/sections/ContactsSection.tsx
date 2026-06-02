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
import type { LegacyContact } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    ComparisonRow,
    EmptyHint,
    InlineRow,
    SubBlock,
} from '../SettingsDeveloperMigrationViewerScreen'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const ContactsSection = ({
    contacts,
    rn,
}: {
    contacts: LegacyContact[]
    rn: RNMigrationSnapshot
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_contacts')}
            count={contacts.length}
        >
            <ComparisonRow
                label='count'
                legacyValue={contacts.length}
                rnValue={rn.contactsByAddress.size}
                matches={contacts.length <= rn.contactsByAddress.size}
            />
            {contacts.length === 0 ? (
                <EmptyHint />
            ) : (
                contacts.map((c, i) => {
                    const rnContact = rn.contactsByAddress.get(
                        c.address.toLowerCase(),
                    )
                    return (
                        <SubBlock
                            key={`${c.address}-${i}`}
                            title={`#${i} — ${c.name}`}
                        >
                            <ComparisonRow
                                label='present in RN'
                                legacyValue={true}
                                rnValue={rnContact !== undefined}
                                matches={rnContact !== undefined}
                            />
                            <ComparisonRow
                                label='name'
                                legacyValue={c.name}
                                rnValue={rnContact?.name ?? '(missing)'}
                                matches={rnContact?.name === c.name}
                            />
                            <InlineRow
                                label='address'
                                value={c.address}
                            />
                            <InlineRow
                                label='avatar'
                                value={c.avatar}
                            />
                        </SubBlock>
                    )
                })
            )}
        </CollapsibleSection>
    )
}
