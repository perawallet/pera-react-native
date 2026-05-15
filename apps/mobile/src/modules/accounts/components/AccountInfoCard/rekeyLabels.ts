/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { AccountLogicalTypes } from '@perawallet/wallet-core-accounts'

import type {
    AccountLogicalType,
    RekeyTransition,
} from '@perawallet/wallet-core-accounts'

const PART_KEY: Record<AccountLogicalType, string> = {
    [AccountLogicalTypes.Algo25]: 'account_info.rekey_part_standard',
    [AccountLogicalTypes.HdKey]: 'account_info.rekey_part_standard',
    [AccountLogicalTypes.LedgerBle]: 'account_info.rekey_part_ledger',
    [AccountLogicalTypes.Multisig]: 'account_info.rekey_part_shared',
    [AccountLogicalTypes.NoAuth]: 'account_info.rekey_part_watch',
    [AccountLogicalTypes.Rekeyed]: 'account_info.rekey_part_standard',
    [AccountLogicalTypes.RekeyedAuth]: 'account_info.rekey_part_standard',
}

export type RekeyLabelI18n = {
    /** i18n key for the "Rekeyed ({{from}} to {{to}})" label. */
    labelKey: string
    /** i18n key for the translated `from` part. */
    fromKey: string
    /** i18n key for the translated `to` part. */
    toKey: string
    /** Description key for the account-type info sheet. */
    descriptionKey: string
}

const descriptionKeyFor = (transition: RekeyTransition): string => {
    const { from, to } = transition
    if (
        from === AccountLogicalTypes.LedgerBle &&
        to === AccountLogicalTypes.LedgerBle
    ) {
        return 'account_type_info.rekeyed_ledger_to_ledger_description'
    }
    if (to === AccountLogicalTypes.LedgerBle) {
        return 'account_type_info.rekeyed_ledger_description'
    }
    return 'account_type_info.rekeyed_standard_description'
}

export const getRekeyLabelI18n = (
    transition: RekeyTransition,
): RekeyLabelI18n => ({
    labelKey: 'account_info.type_rekeyed_transition',
    fromKey: PART_KEY[transition.from],
    toKey: PART_KEY[transition.to],
    descriptionKey: descriptionKeyFor(transition),
})

/**
 * Splits an account type label into its main type and the parenthetical
 * qualifier (e.g. "Rekeyed (Standard to Ledger)" → main "Rekeyed", qualifier
 * "(Standard to Ledger)"), so the qualifier can be rendered in a smaller font.
 * Returns a null qualifier for labels without a parenthetical part.
 */
export const splitAccountTypeLabel = (
    label: string,
): { main: string; qualifier: string | null } => {
    const index = label.indexOf(' (')
    if (index === -1) return { main: label, qualifier: null }
    return {
        main: label.slice(0, index),
        qualifier: label.slice(index + 1),
    }
}
