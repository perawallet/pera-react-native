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

import {
    AccountTypes,
    type AccountType,
    type RekeyTransition,
} from '@perawallet/wallet-core-accounts'

const SIGNER_KEY: Record<AccountType, string> = {
    [AccountTypes.algo25]: 'account_info.rekey_signer_standard',
    [AccountTypes.hdWallet]: 'account_info.rekey_signer_standard',
    [AccountTypes.hardware]: 'account_info.rekey_signer_ledger',
    [AccountTypes.multisig]: 'account_info.rekey_signer_shared',
    [AccountTypes.watch]: 'account_info.rekey_signer_watch',
    [AccountTypes.quantum]: 'account_info.rekey_signer_quantum',
}

export type RekeyLabelI18n = {
    /** i18n key for the "Rekeyed (Signed by {{to}})" label. */
    labelKey: string
    /** i18n key for the translated signer type, interpolated as `to`. */
    signerKey: string
    /** Description key for the account-type info sheet. */
    descriptionKey: string
}

const descriptionKeyFor = (transition: RekeyTransition): string => {
    const { from, to } = transition
    if (to === AccountTypes.multisig) {
        return 'account_type_info.rekeyed_shared_description'
    }
    if (from === AccountTypes.hardware && to === AccountTypes.hardware) {
        return 'account_type_info.rekeyed_ledger_to_ledger_description'
    }
    if (to === AccountTypes.hardware) {
        return 'account_type_info.rekeyed_ledger_description'
    }
    if (to === AccountTypes.quantum) {
        return 'account_type_info.rekeyed_quantum_description'
    }
    return 'account_type_info.rekeyed_standard_description'
}

export const getRekeyLabelI18n = (
    transition: RekeyTransition,
): RekeyLabelI18n => ({
    labelKey: 'account_info.type_rekeyed_signer',
    signerKey: SIGNER_KEY[transition.to],
    descriptionKey: descriptionKeyFor(transition),
})

/**
 * Splits an account type label into its main type and the parenthetical
 * qualifier (e.g. "Rekeyed (Signed by a Ledger account)" → main "Rekeyed",
 * qualifier "(Signed by a Ledger account)"), so the qualifier can be rendered
 * in a smaller font. Returns a null qualifier for labels without a
 * parenthetical part.
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
