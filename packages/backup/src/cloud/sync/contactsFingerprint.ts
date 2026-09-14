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

/** Address and name are the only fields the contact payload carries. `image`
 *  and `nfd` are deliberately absent: reacting to a re-resolved NFD would sync
 *  on a timer the user never touched. */
export const contactsFingerprint = (contacts: readonly Contact[]): string =>
    contacts
        .map(contact => `${contact.address} ${contact.name}`)
        .sort()
        .join('')
