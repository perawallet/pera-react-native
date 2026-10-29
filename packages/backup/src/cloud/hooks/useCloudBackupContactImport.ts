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
import { logger, toError } from '@perawallet/wallet-core-shared'
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
                const existing = store.contacts.find(c => c.id === contact.id)
                try {
                    if (existing) {
                        // Last-write-wins already picked the incoming name, so
                        // it is authoritative. Neither shape carries `image` or
                        // `nfd`, and a legacy item carries a single address,
                        // so the existing contact's are carried over, except
                        // for a family the record says was removed.
                        const addresses = {
                            ...existing.addresses,
                            ...contact.addresses,
                        }
                        for (const family of contact.removedFamilies ?? []) {
                            if (!contact.addresses[family])
                                delete addresses[family]
                        }
                        store.editContact(existing.id, {
                            ...existing,
                            name: contact.name,
                            addresses,
                        })
                    } else {
                        store.addContact(contact)
                    }
                } catch (error) {
                    logger.warn('useCloudBackupContactImport: import failed')
                    summary.failed.push({
                        id: contact.id,
                        reason: toError(error).message,
                    })
                    continue
                }
                summary.imported += 1
            }

            return summary
        }, [])

        return { importContacts }
    }
