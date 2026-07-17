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
    it('maps a standard-to-ledger rekey to standard/ledger parts and ledger description', () => {
        expect(getRekeyLabelI18n({ from: 'algo25', to: 'hardware' })).toEqual({
            labelKey: 'account_info.type_rekeyed_transition',
            fromKey: 'account_info.rekey_part_standard',
            toKey: 'account_info.rekey_part_ledger',
            descriptionKey: 'account_type_info.rekeyed_ledger_description',
        })
    })

    it('maps a ledger-to-ledger rekey to the ledger-to-ledger description', () => {
        expect(getRekeyLabelI18n({ from: 'hardware', to: 'hardware' })).toEqual(
            {
                labelKey: 'account_info.type_rekeyed_transition',
                fromKey: 'account_info.rekey_part_ledger',
                toKey: 'account_info.rekey_part_ledger',
                descriptionKey:
                    'account_type_info.rekeyed_ledger_to_ledger_description',
            },
        )
    })

    it('maps a rekey to a standard auth account to the standard description', () => {
        expect(getRekeyLabelI18n({ from: 'hardware', to: 'algo25' })).toEqual({
            labelKey: 'account_info.type_rekeyed_transition',
            fromKey: 'account_info.rekey_part_ledger',
            toKey: 'account_info.rekey_part_standard',
            descriptionKey: 'account_type_info.rekeyed_standard_description',
        })
    })

    it('maps multisig and watch base types to their parts', () => {
        expect(getRekeyLabelI18n({ from: 'multisig', to: 'watch' })).toEqual({
            labelKey: 'account_info.type_rekeyed_transition',
            fromKey: 'account_info.rekey_part_shared',
            toKey: 'account_info.rekey_part_watch',
            descriptionKey: 'account_type_info.rekeyed_standard_description',
        })
    })

    it('maps a rekey to a shared auth account to the shared description', () => {
        expect(getRekeyLabelI18n({ from: 'multisig', to: 'multisig' })).toEqual(
            {
                labelKey: 'account_info.type_rekeyed_transition',
                fromKey: 'account_info.rekey_part_shared',
                toKey: 'account_info.rekey_part_shared',
                descriptionKey: 'account_type_info.rekeyed_shared_description',
            },
        )
    })

    it('maps a quantum base type to the quantum part', () => {
        expect(getRekeyLabelI18n({ from: 'quantum', to: 'hardware' })).toEqual({
            labelKey: 'account_info.type_rekeyed_transition',
            fromKey: 'account_info.rekey_part_quantum',
            toKey: 'account_info.rekey_part_ledger',
            descriptionKey: 'account_type_info.rekeyed_ledger_description',
        })
    })
})

describe('splitAccountTypeLabel', () => {
    it('splits a label with a parenthetical qualifier', () => {
        expect(splitAccountTypeLabel('Rekeyed (Standard to Ledger)')).toEqual({
            main: 'Rekeyed',
            qualifier: '(Standard to Ledger)',
        })
    })

    it('returns a null qualifier for a label without parentheses', () => {
        expect(splitAccountTypeLabel('Ledger Account')).toEqual({
            main: 'Ledger Account',
            qualifier: null,
        })
    })
})
