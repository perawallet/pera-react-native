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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useUniqueAccountName } from '@hooks/useUniqueAccountName'
import { accountForType } from '@test-utils/accountCustody'

const mockAccounts = vi.hoisted(() => ({ current: [] as WalletAccount[] }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mockAccounts.current,
}))

const ADDRESS = 'XYZ7MHAEQKWGVHKQWDN3QDCUFHP6DSRIZQDMBRBIDXUT5HUEMU3QT7LQ'

const named = (id: string, name: string): WalletAccount =>
    accountForType('watch', ADDRESS, { id, name })

const render = () => renderHook(() => useUniqueAccountName()).result.current

describe('useUniqueAccountName', () => {
    beforeEach(() => {
        mockAccounts.current = []
    })

    describe('isAccountNameTaken', () => {
        it('matches another account regardless of case and surrounding spaces', () => {
            mockAccounts.current = [named('a', 'Savings')]

            expect(render().isAccountNameTaken('  sAVINGS ')).toBe(true)
            expect(render().isAccountNameTaken('Savings 2')).toBe(false)
        })

        it('ignores the excepted account', () => {
            mockAccounts.current = [named('a', 'Savings')]

            expect(render().isAccountNameTaken('Savings', 'a')).toBe(false)
            expect(render().isAccountNameTaken('Savings', 'b')).toBe(true)
        })

        it('never counts an empty name', () => {
            mockAccounts.current = [named('a', '')]

            expect(render().isAccountNameTaken('   ')).toBe(false)
            expect(render().isAccountNameTaken('')).toBe(false)
        })
    })

    describe('hasDuplicateName', () => {
        it('is true for accounts with the same name and false for a unique one', () => {
            const first = named('a', 'Account #1')
            const second = named('b', 'account #1 ')
            const unique = named('c', 'Account #2')
            mockAccounts.current = [first, second, unique]
            const { hasDuplicateName } = render()

            expect(hasDuplicateName(first)).toBe(true)
            expect(hasDuplicateName(second)).toBe(true)
            expect(hasDuplicateName(unique)).toBe(false)
        })
    })
})
