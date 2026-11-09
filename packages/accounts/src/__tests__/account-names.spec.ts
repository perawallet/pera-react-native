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

import { afterEach, describe, expect, test } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_ACCOUNT_NAME_TEMPLATES,
    accountNameKindOf,
    nextAccountName,
    setAccountNameTemplates,
    withAccountNames,
} from '../account-names'
import type { WalletAccount } from '../models'
import { testAccount, type TestCustody } from './accountFactory'
import { FAKE_CHAIN_ID } from './fakeAccountsChain'

const ADDRESS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const named = (
    name: string,
    address = `${name}-ADDR`,
    custody: TestCustody = 'watch',
): WalletAccount => testAccount(custody, address, { id: address, name })

describe('account names', () => {
    afterEach(() => {
        setAccountNameTemplates(DEFAULT_ACCOUNT_NAME_TEMPLATES)
    })

    test('starts at 1 when no name uses the template', () => {
        expect(nextAccountName([named('Savings')])).toBe('Account #1')
    })

    test('numbers one past the highest, leaving gaps unfilled', () => {
        expect(
            nextAccountName([named('Account #1'), named('Account #7')]),
        ).toBe('Account #8')
    })

    test('reads a number regardless of case and surrounding spaces', () => {
        expect(nextAccountName([named(' account #4 ')])).toBe('Account #5')
    })

    test('ignores names that only resemble the template', () => {
        expect(
            nextAccountName([
                named('Account #3a'),
                named('My Account #9'),
                named('Account #'),
            ]),
        ).toBe('Account #1')
    })

    test('numbers each kind from its own template', () => {
        const accounts = [
            named('Account #4'),
            named('Shared Account #2', 'S', 'multisig'),
            named('Ledger Account #6', 'L', 'hardware'),
        ]

        expect(nextAccountName(accounts)).toBe('Account #5')
        expect(nextAccountName(accounts, 'shared')).toBe('Shared Account #3')
        expect(nextAccountName(accounts, 'ledger')).toBe('Ledger Account #7')
    })

    test.each([
        ['hardware', 'ledger'],
        ['multisig', 'shared'],
        ['watch', 'account'],
        ['local', 'account'],
        ['hd', 'account'],
    ] as const)('names a %s account as a %s account', (custody, kind) => {
        expect(accountNameKindOf(named('x', 'X', custody))).toBe(kind)
    })

    test('names unnamed accounts in order, by kind, and keeps named ones', () => {
        const accounts = [
            named('', 'A'),
            named('Account #2', 'B'),
            named('', 'C', 'hardware'),
            named('Savings', 'D'),
            named('', 'E'),
            named('', 'F', 'hardware'),
        ]

        expect(withAccountNames(accounts).map(({ name }) => name)).toEqual([
            'Account #3',
            'Account #2',
            'Ledger Account #1',
            'Savings',
            'Account #4',
            'Ledger Account #2',
        ])
    })

    test("numbers and parses in the app's language", () => {
        setAccountNameTemplates({
            account: 'Hesap #{{number}}',
            shared: 'Paylaşılan hesap #{{number}}',
            ledger: 'Ledger hesabı #{{number}}',
        })

        expect(nextAccountName([named('Hesap #2')])).toBe('Hesap #3')
        expect(nextAccountName([], 'ledger')).toBe('Ledger hesabı #1')
        setAccountNameTemplates({
            account: 'Konto Nr. {{number}}',
            shared: 'Gemeinschaftskonto Nr. {{number}}',
            ledger: 'Ledger-Konto Nr. {{number}}',
        })
        expect(nextAccountName([named('Konto Nr. 2')])).toBe('Konto Nr. 3')
    })

    test('numbers past names given in any known language', () => {
        const german = {
            account: 'Konto Nr. {{number}}',
            shared: 'Gemeinschaftskonto Nr. {{number}}',
            ledger: 'Ledger-Konto Nr. {{number}}',
        }
        setAccountNameTemplates(german, [german])

        expect(nextAccountName([named('Account #3')])).toBe('Konto Nr. 4')
        setAccountNameTemplates(DEFAULT_ACCOUNT_NAME_TEMPLATES, [german])
        expect(nextAccountName([named('Konto Nr. 5')])).toBe('Account #6')
    })

    test.each([
        ['a 6+6 cut', 'ABCDEF...UVWXYZ'],
        ['an ellipsis cut', 'ABCDEF…UVWXYZ'],
        ['the full address', ADDRESS],
    ])(
        "gives an account named with %s of its own address the chain's truncation",
        (_, name) => {
            const [account] = withAccountNames([named(name, ADDRESS)])

            expect(account?.name).toBe(
                addressCodecs.get(FAKE_CHAIN_ID).truncate(ADDRESS),
            )
        },
    )

    test('keeps a name that is a cut of some other address', () => {
        const [account] = withAccountNames([named('ZZZZZZ...UVWXYZ', ADDRESS)])

        expect(account?.name).toBe('ZZZZZZ...UVWXYZ')
    })

    test('keeps a template when handed one without the number', () => {
        setAccountNameTemplates({
            ...DEFAULT_ACCOUNT_NAME_TEMPLATES,
            account: 'Hesap',
        })

        expect(nextAccountName([])).toBe('Account #1')
    })
})
