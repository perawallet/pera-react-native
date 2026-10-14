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
import type { Contact } from '@perawallet/wallet-core-contacts'
import { BackupItemType, contactItemKey } from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import { withContentHash } from './buildLocalItems'
import type { LocalItem } from './types'

/** Kept separate from `buildLocalItems` so the account builder's `skipped`
 *  count stays account-only: a contact has no key material and can never fail
 *  to serialize. `updatedAt` is epoch millis; `pushDirty` overwrites it with
 *  the tracked `localUpdatedAt` before encrypting. The payload's bare address
 *  predates chain families, so only the legacy family's goes in and a contact
 *  without one is not backed up. */
export const buildLocalContactItems = (
    contacts: readonly Contact[],
    updatedAt: number,
    hashAddress: ItemKeyHasher,
): LocalItem[] =>
    contacts.flatMap(contact => {
        const address = contact.addresses[LEGACY_CHAIN_FAMILY]
        if (!address) return []
        return [
            withContentHash({
                key: contactItemKey(hashAddress(address)),
                type: BackupItemType.CONTACT,
                payload: {
                    address,
                    name: contact.name,
                    updatedAt,
                },
            }),
        ]
    })
