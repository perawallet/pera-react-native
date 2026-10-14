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

import type { Contact } from '@perawallet/wallet-core-contacts'
import {
    BackupItemType,
    CONTACT_RECORD_FORMAT_VERSION,
    contactAddressEntries,
    contactRecordItemKey,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { withContentHash } from './buildLocalItems'
import type { LocalItem } from './types'

/** Kept separate from `buildLocalItems` so the account builder's `skipped`
 *  count stays account-only: a contact has no key material and can never fail
 *  to serialize. `updatedAt` is epoch millis; `pushDirty` overwrites it with
 *  the tracked `localUpdatedAt` before encrypting. The record is keyed on the
 *  hash of the contact's first address, which every device derives the same
 *  way; a contact with no address is not backed up. */
export const buildLocalContactItems = (
    contacts: readonly Contact[],
    updatedAt: number,
    hashAddress: ItemKeyHasher,
): LocalItem[] =>
    contacts.flatMap(contact => {
        const addresses = contactAddressEntries(contact.addresses)
        const [primary] = addresses
        if (!primary) return []
        return [
            withContentHash({
                key: contactRecordItemKey(hashAddress(primary.address)),
                type: BackupItemType.CONTACT,
                payload: {
                    formatVersion: CONTACT_RECORD_FORMAT_VERSION,
                    name: contact.name,
                    updatedAt,
                    addresses,
                },
            }),
        ]
    })
