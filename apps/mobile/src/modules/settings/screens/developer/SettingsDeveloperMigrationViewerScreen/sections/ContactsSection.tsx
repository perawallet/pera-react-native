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

import type { LegacyContact } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { LegacyVsRnRow } from '../components/LegacyVsRnRow'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../components/MigrationDataSubBlock'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const ContactsSection = ({
    contacts,
    rn,
}: {
    contacts: LegacyContact[]
    rn: RNMigrationSnapshot
}) => {
    return (
        <MigrationDataSection
            title='Contacts'
            count={contacts.length}
        >
            <LegacyVsRnRow
                label='count'
                legacyValue={contacts.length}
                rnValue={rn.contactsByAddress.size}
                matches={contacts.length <= rn.contactsByAddress.size}
            />
            {contacts.length === 0 ? (
                <EmptyDataHint />
            ) : (
                contacts.map((c, i) => {
                    const rnContact = rn.contactsByAddress.get(
                        c.address.toLowerCase(),
                    )
                    return (
                        <MigrationDataSubBlock
                            key={`${c.address}-${i}`}
                            title={`#${i} — ${c.name}`}
                        >
                            <LegacyVsRnRow
                                label='present in RN'
                                legacyValue={true}
                                rnValue={rnContact !== undefined}
                                matches={rnContact !== undefined}
                            />
                            <LegacyVsRnRow
                                label='name'
                                legacyValue={c.name}
                                rnValue={rnContact?.name ?? '(missing)'}
                                matches={rnContact?.name === c.name}
                            />
                            <MigrationDataRow
                                label='address'
                                value={c.address}
                            />
                            <MigrationDataRow
                                label='avatar'
                                value={c.avatar}
                            />
                        </MigrationDataSubBlock>
                    )
                })
            )}
        </MigrationDataSection>
    )
}
