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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { NameServiceId } from '@perawallet/wallet-core-names'

export type NameServiceCopy = {
    resultsTitleKey: I18nKey
    mismatchTitleKey: I18nKey
    mismatchBodyKey: I18nKey
    unavailableTitleKey: I18nKey
    unavailableBodyKey: I18nKey
    /** The heading over an address's name on the contact detail. */
    addressNameLabelKey: I18nKey
}

/** What the address picker, the send checks and the contact detail say, so a name never gets another service's name. */
export const NAME_SERVICE_COPY: Readonly<
    Record<NameServiceId, NameServiceCopy>
> = {
    nfd: {
        resultsTitleKey: i18nKey('address_entry.nfd_results'),
        mismatchTitleKey: i18nKey('send_funds.destination.nfd_mismatch_title'),
        mismatchBodyKey: i18nKey('send_funds.destination.nfd_mismatch_body'),
        unavailableTitleKey: i18nKey(
            'send_funds.destination.nfd_unavailable_title',
        ),
        unavailableBodyKey: i18nKey(
            'send_funds.destination.nfd_unavailable_body',
        ),
        addressNameLabelKey: i18nKey('contacts.view_contact.nfd_label'),
    },
    ens: {
        resultsTitleKey: i18nKey('address_entry.ens_results'),
        mismatchTitleKey: i18nKey('send_funds.destination.ens_mismatch_title'),
        mismatchBodyKey: i18nKey('send_funds.destination.ens_mismatch_body'),
        unavailableTitleKey: i18nKey(
            'send_funds.destination.ens_unavailable_title',
        ),
        unavailableBodyKey: i18nKey(
            'send_funds.destination.ens_unavailable_body',
        ),
        addressNameLabelKey: i18nKey('contacts.view_contact.ens_label'),
    },
}
