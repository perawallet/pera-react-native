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
import {
    DuplicateAddressError,
    useContactsStore,
} from '@perawallet/wallet-core-contacts'
import { logger } from '@perawallet/wallet-core-shared'
import type { ContactImportFn, ContactImportSummary } from '../sync/types'

export type UseCloudBackupContactImportResult = {
    importContacts: ContactImportFn
}

export const useCloudBackupContactImport =
    (): UseCloudBackupContactImportResult => {
        const importContacts = useCallback<ContactImportFn>(async payloads => {
            const summary: ContactImportSummary = { imported: 0, failed: [] }

            for (const payload of payloads) {
                // Read the live store each time: appends earlier in this loop
                // must be visible to the duplicate check below.
                const store = useContactsStore.getState()
                try {
                    store.addContact({
                        address: payload.address,
                        name: payload.name,
                    })
                } catch (error) {
                    if (!(error instanceof DuplicateAddressError)) {
                        logger.warn(
                            'useCloudBackupContactImport: import failed',
                            { address: payload.address },
                        )
                        summary.failed.push({
                            address: payload.address,
                            reason:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        })
                        continue
                    }
                    // Last-write-wins already picked the incoming record, so it
                    // is authoritative. `image` is device-local and `nfd` is
                    // re-resolvable, so both are carried over rather than lost.
                    const existing = store.contacts.find(
                        contact => contact.address === payload.address,
                    )
                    store.editContact(payload.address, {
                        ...existing,
                        address: payload.address,
                        name: payload.name,
                    })
                }
                summary.imported += 1
            }

            return summary
        }, [])

        return { importContacts }
    }
