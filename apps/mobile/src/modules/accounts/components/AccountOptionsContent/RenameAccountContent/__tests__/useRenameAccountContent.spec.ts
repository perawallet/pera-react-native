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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { accountForType } from '@test-utils/accountCustody'
import { useRenameAccountContent } from '../useRenameAccountContent'

const mockAccounts = vi.hoisted(() => ({ current: [] as WalletAccount[] }))
const mockResolve = vi.hoisted(() => vi.fn())

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mockAccounts.current,
    useAccountsStore: (
        selector: (state: { accounts: WalletAccount[] }) => unknown,
    ) => selector({ accounts: mockAccounts.current }),
}))

const ADDRESS = 'XYZ7MHAEQKWGVHKQWDN3QDCUFHP6DSRIZQDMBRBIDXUT5HUEMU3QT7LQ'

const named = (id: string, name: string) =>
    accountForType('standalone', ADDRESS, { id, name })

describe('useRenameAccountContent', () => {
    beforeEach(() => {
        mockResolve.mockClear()
        mockAccounts.current = [named('a', 'Savings'), named('b', 'Trading')]
    })

    it('starts from the stored name, which is not a duplicate of itself', () => {
        const { result } = renderHook(() => useRenameAccountContent('a'))

        expect(result.current.name).toBe('Savings')
        expect(result.current.nameError).toBeUndefined()
        expect(result.current.isSaveDisabled).toBe(false)
    })

    it("blocks another account's name in any case, and Save resolves nothing", () => {
        const { result } = renderHook(() => useRenameAccountContent('a'))

        act(() => {
            result.current.handleNameChange('  tRADING ')
        })
        act(() => {
            result.current.handleSave()
        })

        expect(result.current.nameError).toBe('account_info.name_taken')
        expect(result.current.isSaveDisabled).toBe(true)
        expect(mockResolve).not.toHaveBeenCalled()
    })

    it('disables Save on an empty name without an error message', () => {
        const { result } = renderHook(() => useRenameAccountContent('a'))

        act(() => {
            result.current.handleNameChange('   ')
        })

        expect(result.current.nameError).toBeUndefined()
        expect(result.current.isSaveDisabled).toBe(true)
    })

    it('resolves the trimmed name on Save', () => {
        const { result } = renderHook(() => useRenameAccountContent('a'))

        act(() => {
            result.current.handleNameChange('  Long-term  ')
        })
        act(() => {
            result.current.handleSave()
        })

        expect(mockResolve).toHaveBeenCalledWith('Long-term')
    })
})
