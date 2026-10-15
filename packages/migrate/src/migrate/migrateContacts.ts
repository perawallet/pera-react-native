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

import { LEGACY_CHAIN_FAMILY } from '@perawallet/wallet-core-chain-contract'
import {
    derivedContactId,
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
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
        store.contacts.flatMap(c => {
            const address = c.addresses[LEGACY_CHAIN_FAMILY]
            return address ? [[address.toLowerCase(), c] as const] : []
        }),
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

// The derived id, so the same contact migrated on two devices backs up as one.
const toContact = (legacy: LegacyContact): Contact => {
    const addresses = { [LEGACY_CHAIN_FAMILY]: legacy.address }
    return {
        id: derivedContactId(addresses) ?? generateUniqueId(),
        name: legacy.name,
        addresses,
        image: legacy.avatar ?? undefined,
    }
}
