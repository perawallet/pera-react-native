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

import { useMemo } from 'react'
import {
    contactAddressEntries,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { useLanguage } from '@hooks/useLanguage'
import { chainFamilyDisplay } from '@modules/chain-ui'

export type UseContactRowResult = {
    /** The first address, which names the row in test ids. */
    primaryAddress: string
    /** The single address truncated, or how many networks the contact spans. */
    subtitle: string
}

export const useContactRow = (contact: Contact): UseContactRowResult => {
    const { t } = useLanguage()
    return useMemo(() => {
        const entries = contactAddressEntries(contact.addresses)
        const [first] = entries
        const subtitle =
            entries.length > 1
                ? t('contacts.list.networks_count', { count: entries.length })
                : first
                  ? chainFamilyDisplay(first.family, t).truncate(first.address)
                  : ''
        return { primaryAddress: first?.address ?? '', subtitle }
    }, [contact.addresses, t])
}
