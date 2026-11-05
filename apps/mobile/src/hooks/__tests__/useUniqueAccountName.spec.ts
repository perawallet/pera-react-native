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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useUniqueAccountName } from '@hooks/useUniqueAccountName'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { accountForType } from '@test-utils/accountCustody'

const mockAccounts = vi.hoisted(() => ({ current: [] as WalletAccount[] }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mockAccounts.current,
}))

const ADDRESS = 'XYZ7MHAEQKWGVHKQWDN3QDCUFHP6DSRIZQDMBRBIDXUT5HUEMU3QT7LQ'

const numbered = (number: number) =>
    `account_info.account_number ${JSON.stringify({ number })}`

const hdAccount = (
    id: string,
    account: number,
    overrides: Partial<WalletAccount> = {},
): WalletAccount =>
    accountForType('hdWallet', ADDRESS, {
        id,
        custody: { kind: 'local', seed: 'bip39', hd: { account, keyIndex: 0 } },
        ...overrides,
    })

const render = () => renderHook(() => useUniqueAccountName()).result.current

describe('useUniqueAccountName', () => {
    beforeAll(() => {
        registerAlgorandAddressCodec()
    })

    beforeEach(() => {
        mockAccounts.current = []
    })

    describe('isAccountNameTaken', () => {
        it('matches another account regardless of case and surrounding spaces', () => {
            mockAccounts.current = [hdAccount('a', 0, { name: 'Savings' })]

            expect(render().isAccountNameTaken('  sAVINGS ')).toBe(true)
            expect(render().isAccountNameTaken('Savings 2')).toBe(false)
        })

        it('counts the generated number of an unnamed account as its name', () => {
            mockAccounts.current = [hdAccount('a', 0)]

            expect(render().isAccountNameTaken(numbered(1))).toBe(true)
        })

        it('ignores the excepted account', () => {
            mockAccounts.current = [hdAccount('a', 0, { name: 'Savings' })]

            expect(render().isAccountNameTaken('Savings', 'a')).toBe(false)
            expect(render().isAccountNameTaken('Savings', 'b')).toBe(true)
        })

        it('never counts an empty name or an account shown by its address', () => {
            mockAccounts.current = [
                accountForType('watch', ADDRESS, { id: 'w' }),
            ]

            expect(render().isAccountNameTaken('   ')).toBe(false)
            expect(render().isAccountNameTaken('')).toBe(false)
        })
    })

    describe('hasDuplicateName', () => {
        it('is true for accounts that show the same name', () => {
            const first = hdAccount('a', 0)
            const second = hdAccount('b', 0)
            mockAccounts.current = [first, second, hdAccount('c', 1)]
            const { hasDuplicateName } = render()

            expect(hasDuplicateName(first)).toBe(true)
            expect(hasDuplicateName(second)).toBe(true)
        })

        it('is false for a unique name and for an account shown by its address', () => {
            const unique = hdAccount('c', 1)
            const watch = accountForType('watch', ADDRESS, { id: 'w' })
            mockAccounts.current = [hdAccount('a', 0), unique, watch]
            const { hasDuplicateName } = render()

            expect(hasDuplicateName(unique)).toBe(false)
            expect(hasDuplicateName(watch)).toBe(false)
        })
    })

    describe('nextFreeAccountName', () => {
        it('skips every number another account shows', () => {
            mockAccounts.current = [
                hdAccount('a', 0),
                hdAccount('b', 1),
                hdAccount('c', 0, { name: numbered(3).toUpperCase() }),
            ]

            expect(render().nextFreeAccountName(1)).toBe(numbered(4))
        })

        it('starts at the number given and ignores the excepted account', () => {
            mockAccounts.current = [hdAccount('a', 0)]

            expect(render().nextFreeAccountName(2)).toBe(numbered(2))
            expect(render().nextFreeAccountName(1, 'a')).toBe(numbered(1))
        })
    })
})
