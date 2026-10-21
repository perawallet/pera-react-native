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
import { act, renderHook } from '@testing-library/react'
import { useSaveRecipientContact } from '../useSaveRecipientContact'

const mocks = vi.hoisted(() => ({
    accounts: [] as { address: string }[],
    contacts: [] as { addresses: Record<string, string> }[],
    navigate: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mocks.accounts,
    findAccountByAddressOn: (
        accounts: { address: string }[],
        _chainId: string,
        address: string,
    ) => accounts.find(account => account.address === address),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        family: chainId === 'algorand' ? 'algorand' : 'evm',
    }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ contacts: mocks.contacts }),
    findContactByAddress: (
        contacts: { addresses: Record<string, string> }[],
        address: string,
        family: string,
    ) =>
        contacts.find(
            contact =>
                contact.addresses[family]?.toLowerCase() ===
                address.toLowerCase(),
        ),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as never

describe('useSaveRecipientContact', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = []
        mocks.contacts = []
    })

    it('offers to save a recipient the user does not know', () => {
        const { result } = renderHook(() =>
            useSaveRecipientContact('0xB0B', ETHEREUM),
        )

        expect(result.current.canSaveRecipient).toBe(true)
    })

    it("does not offer one of the user's own accounts", () => {
        mocks.accounts = [{ address: '0xB0B' }]

        const { result } = renderHook(() =>
            useSaveRecipientContact('0xB0B', ETHEREUM),
        )

        expect(result.current.canSaveRecipient).toBe(false)
    })

    it("does not offer an address a contact holds in the recipient's family, whatever its case", () => {
        mocks.contacts = [{ addresses: { evm: '0xb0b' } }]

        const { result } = renderHook(() =>
            useSaveRecipientContact('0xB0B', ETHEREUM),
        )

        expect(result.current.canSaveRecipient).toBe(false)
    })

    it('still offers it when a contact holds the address only in another family', () => {
        mocks.contacts = [{ addresses: { algorand: '0xB0B' } }]

        const { result } = renderHook(() =>
            useSaveRecipientContact('0xB0B', ETHEREUM),
        )

        expect(result.current.canSaveRecipient).toBe(true)
    })

    it('opens Add Contact prefilled with the recipient on its chain', () => {
        const { result } = renderHook(() =>
            useSaveRecipientContact('0xB0B', ETHEREUM),
        )

        act(() => result.current.saveRecipient())

        expect(mocks.navigate).toHaveBeenCalledWith('AddContact', {
            address: '0xB0B',
            chainId: 'ethereum',
        })
    })

    it('offers nothing without a recipient', () => {
        const { result } = renderHook(() =>
            useSaveRecipientContact(undefined, ETHEREUM),
        )

        expect(result.current.canSaveRecipient).toBe(false)
    })
})
