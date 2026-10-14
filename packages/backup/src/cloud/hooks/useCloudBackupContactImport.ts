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

import { useCallback } from 'react'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { logger } from '@perawallet/wallet-core-shared'
import { contactAddressEntries } from '../models'
import type { ContactImportFn, ContactImportSummary } from '../sync/types'

export type UseCloudBackupContactImportResult = {
    importContacts: ContactImportFn
}

export const useCloudBackupContactImport =
    (): UseCloudBackupContactImportResult => {
        const importContacts = useCallback<ContactImportFn>(async incoming => {
            const summary: ContactImportSummary = { imported: 0, failed: [] }

            for (const contact of incoming) {
                // Read the live store each time: appends earlier in this loop
                // must be visible to the match below.
                const store = useContactsStore.getState()
                const entries = contactAddressEntries(contact.addresses)
                const matched = entries.find(({ family, address }) =>
                    store.contacts.some(c => c.addresses[family] === address),
                )
                try {
                    if (matched) {
                        // Last-write-wins already picked the incoming name, so
                        // it is authoritative. Neither shape carries `image` or
                        // `nfd`, and a legacy item carries a single address,
                        // so the existing contact's are carried over.
                        const existing = store.contacts.find(
                            c =>
                                c.addresses[matched.family] === matched.address,
                        )
                        store.editContact(matched, {
                            ...existing,
                            name: contact.name,
                            addresses: {
                                ...existing?.addresses,
                                ...contact.addresses,
                            },
                        })
                    } else {
                        store.addContact(contact)
                    }
                } catch (error) {
                    logger.warn('useCloudBackupContactImport: import failed')
                    summary.failed.push({
                        address: entries[0]?.address ?? '',
                        reason:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    })
                    continue
                }
                summary.imported += 1
            }

            return summary
        }, [])

        return { importContacts }
    }
