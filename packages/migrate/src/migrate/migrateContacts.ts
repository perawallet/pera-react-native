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

import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import type { LegacyContact } from '@perawallet/wallet-extension-platform'

export type ContactMigrationResult = {
    imported: number
    skipped: number
}

export const migrateContacts = (
    legacyContacts: LegacyContact[],
): ContactMigrationResult => {
    const store = useContactsStore.getState()
    const existingByAddress = new Map(
        store.contacts.map(c => [c.address.toLowerCase(), c] as const),
    )

    const next: Contact[] = [...store.contacts]
    const result: ContactMigrationResult = { imported: 0, skipped: 0 }

    for (const legacy of legacyContacts) {
        const addressKey = legacy.address.toLowerCase()
        if (existingByAddress.has(addressKey)) {
            result.skipped += 1
            continue
        }
        next.push(toContact(legacy))
        existingByAddress.set(addressKey, next[next.length - 1])
        result.imported += 1
    }

    if (result.imported > 0) useContactsStore.setState({ contacts: next })
    return result
}

const toContact = (legacy: LegacyContact): Contact => ({
    name: legacy.name,
    address: legacy.address,
    image: legacy.avatar ?? undefined,
})
