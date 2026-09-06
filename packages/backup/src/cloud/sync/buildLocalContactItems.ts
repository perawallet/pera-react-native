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
import { BackupItemType, contactItemKey } from '../models'
import { withContentHash } from './buildLocalItems'
import type { LocalItem } from './types'

/** Kept separate from `buildLocalItems` so the account builder's `skipped`
 *  count stays account-only: a contact has no key material and can never fail
 *  to serialize. `updatedAt` is epoch millis; `pushDirty` overwrites it with
 *  the tracked `localUpdatedAt` before encrypting. */
export const buildLocalContactItems = (
    contacts: readonly Contact[],
    updatedAt: number,
): LocalItem[] =>
    contacts.map(contact =>
        withContentHash({
            key: contactItemKey(contact.address),
            type: BackupItemType.CONTACT,
            payload: {
                address: contact.address,
                name: contact.name,
                updatedAt,
            },
        }),
    )
