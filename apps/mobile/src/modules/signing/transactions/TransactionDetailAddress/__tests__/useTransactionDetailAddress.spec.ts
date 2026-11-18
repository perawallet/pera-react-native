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
import {
    getAccountDisplayName,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useNameForAddressQuery } from '@perawallet/wallet-core-names'
import { useTransactionDetailAddress } from '../useTransactionDetailAddress'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useFindAccountByAddress: vi.fn(),
    getAccountDisplayName: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getChainDescriptor: () => ({ family: 'evm' }),
}))

vi.mock('@perawallet/wallet-core-names', () => ({
    useNameForAddressQuery: vi.fn(),
}))

const mockContacts: { contacts: Contact[] } = { contacts: [] }
vi.mock('@perawallet/wallet-core-contacts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-contacts')
    >()),
    useContacts: () => mockContacts,
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS = '0x00000000000000000000000000000000000000aa'
const ACCOUNT = { id: 'a1', name: 'Savings' } as WalletAccount

describe('useTransactionDetailAddress', () => {
    beforeEach(() => {
        vi.mocked(useFindAccountByAddress).mockReset()
        vi.mocked(getAccountDisplayName).mockReset()
        mockContacts.contacts = []
        vi.mocked(useNameForAddressQuery)
            .mockReset()
            .mockReturnValue({ data: [], isPending: false })
    })

    it("Given the user's own address, then it names that account", () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(ACCOUNT)
        vi.mocked(getAccountDisplayName).mockReturnValue('Savings')

        const { result } = renderHook(() =>
            useTransactionDetailAddress(ADDRESS, SCOPE),
        )

        expect(useFindAccountByAddress).toHaveBeenCalledWith(ADDRESS, SCOPE)
        expect(getAccountDisplayName).toHaveBeenCalledWith(ACCOUNT, 'ethereum')
        expect(result.current).toEqual({
            ownAccount: ACCOUNT,
            ownAccountName: 'Savings',
            contact: undefined,
            addressName: undefined,
            isAddressInFull: false,
        })
    })

    it('Given an address the user does not hold on this chain, then it names no account', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)

        const { result } = renderHook(() =>
            useTransactionDetailAddress(ADDRESS, SCOPE),
        )

        expect(result.current).toEqual({
            ownAccount: null,
            ownAccountName: undefined,
            contact: undefined,
            addressName: undefined,
            isAddressInFull: false,
        })
        expect(getAccountDisplayName).not.toHaveBeenCalled()
    })

    it('Given a contact holds the address, then it names that contact', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        const contact = {
            name: 'Alice',
            addresses: { evm: ADDRESS },
        } as unknown as Contact
        mockContacts.contacts = [contact]

        const { result } = renderHook(() =>
            useTransactionDetailAddress(ADDRESS, SCOPE),
        )

        expect(result.current.contact).toBe(contact)
    })

    it('Given a verified name and no account or contact, then it returns the name and asks for the full address', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        vi.mocked(useNameForAddressQuery).mockReturnValue({
            data: [{ name: 'alice.eth', source: 'ens', image: '' }],
            isPending: false,
        })

        const { result } = renderHook(() =>
            useTransactionDetailAddress(ADDRESS, SCOPE),
        )

        expect(useNameForAddressQuery).toHaveBeenCalledWith(SCOPE, ADDRESS, {
            enabled: true,
        })
        expect(result.current.addressName).toBe('alice.eth')
        expect(result.current.isAddressInFull).toBe(true)
    })

    it.each([
        ['an own account', ACCOUNT, []],
        [
            'a contact',
            null,
            [
                {
                    name: 'Alice',
                    addresses: { evm: ADDRESS },
                } as unknown as Contact,
            ],
        ],
    ])(
        'Given %s holds the address, then no name lookup runs and the address is not forced to full',
        (_label, account, contacts) => {
            vi.mocked(useFindAccountByAddress).mockReturnValue(account)
            vi.mocked(getAccountDisplayName).mockReturnValue('Savings')
            mockContacts.contacts = contacts

            const { result } = renderHook(() =>
                useTransactionDetailAddress(ADDRESS, SCOPE),
            )

            expect(useNameForAddressQuery).toHaveBeenCalledWith(
                SCOPE,
                ADDRESS,
                { enabled: false },
            )
            expect(result.current.addressName).toBeUndefined()
            expect(result.current.isAddressInFull).toBe(false)
        },
    )
})
