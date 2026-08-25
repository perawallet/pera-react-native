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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

import { getRekeyLabelI18n, splitAccountTypeLabel } from '../rekeyLabels'

describe('getRekeyLabelI18n', () => {
    it('names the ledger signer for a rekey to a Ledger auth account', () => {
        expect(getRekeyLabelI18n({ from: 'algo25', to: 'hardware' })).toEqual({
            labelKey: 'account_info.type_rekeyed_signer',
            signerKey: 'account_info.rekey_signer_ledger',
            descriptionKey: 'account_type_info.rekeyed_ledger_description',
        })
    })

    it('keeps the ledger signer but swaps the description for ledger-to-ledger', () => {
        expect(getRekeyLabelI18n({ from: 'hardware', to: 'hardware' })).toEqual(
            {
                labelKey: 'account_info.type_rekeyed_signer',
                signerKey: 'account_info.rekey_signer_ledger',
                descriptionKey:
                    'account_type_info.rekeyed_ledger_to_ledger_description',
            },
        )
    })

    it('names the standard signer for a rekey to an HD auth account', () => {
        expect(getRekeyLabelI18n({ from: 'watch', to: 'hdWallet' })).toEqual({
            labelKey: 'account_info.type_rekeyed_signer',
            signerKey: 'account_info.rekey_signer_standard',
            descriptionKey: 'account_type_info.rekeyed_standard_description',
        })
    })

    it('names the shared signer for a rekey to a shared auth account', () => {
        expect(getRekeyLabelI18n({ from: 'multisig', to: 'multisig' })).toEqual(
            {
                labelKey: 'account_info.type_rekeyed_signer',
                signerKey: 'account_info.rekey_signer_shared',
                descriptionKey: 'account_type_info.rekeyed_shared_description',
            },
        )
    })

    it('names the quantum signer for a rekey to a Quantum auth account', () => {
        expect(getRekeyLabelI18n({ from: 'watch', to: 'quantum' })).toEqual({
            labelKey: 'account_info.type_rekeyed_signer',
            signerKey: 'account_info.rekey_signer_quantum',
            descriptionKey: 'account_type_info.rekeyed_quantum_description',
        })
    })

    it('ignores the rekeyed account own type — only the signer drives the label', () => {
        expect(getRekeyLabelI18n({ from: 'watch', to: 'hardware' })).toEqual(
            getRekeyLabelI18n({ from: 'quantum', to: 'hardware' }),
        )
    })
})

describe('splitAccountTypeLabel', () => {
    it('splits a label with a parenthetical qualifier', () => {
        expect(
            splitAccountTypeLabel('Rekeyed (Signed by a Ledger account)'),
        ).toEqual({
            main: 'Rekeyed',
            qualifier: '(Signed by a Ledger account)',
        })
    })

    it('returns a null qualifier for a label without parentheses', () => {
        expect(splitAccountTypeLabel('Ledger Account')).toEqual({
            main: 'Ledger Account',
            qualifier: null,
        })
    })
})
