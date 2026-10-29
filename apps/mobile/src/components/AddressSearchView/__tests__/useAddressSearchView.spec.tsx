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

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from '../useAddressSearchView'
import {
    addressFamilyOf,
    useContacts,
    type ContactAddresses,
} from '@perawallet/wallet-core-contacts'
import {
    useAllAccounts,
    useSortedAccounts,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNfdSearchQuery } from '@perawallet/wallet-core-nfd'

vi.mock('@perawallet/wallet-core-contacts', () => ({
    addressFamilyOf: vi.fn(),
    useContacts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => {
    const addressOn = (
        account: { chains?: Record<string, { address?: string }> },
        scope: { chainId: string },
    ) => account.chains?.[scope.chainId]?.address
    return {
        addressOn,
        findAddressHolder: (
            accounts: Array<{ chains?: Record<string, { address?: string }> }>,
            scope: { chainId: string },
            address: string,
        ) => accounts.find(a => addressOn(a, scope) === address),
        useAllAccounts: vi.fn(),
        useSortedAccounts: vi.fn(),
        useAccountValueTotalsQuery: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        family: chainId === 'ethereum' ? 'evm' : 'algorand',
        displayName: chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
    }),
}))

// Echo params so a test can see what reaches the copy.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const mockFamiliesWithCopy = new Set(['algorand', 'evm'])
const mockFamiliesWithPlaceholder = new Set(['algorand', 'evm'])
const mockChainName = vi.hoisted(() => ({
    value: undefined as string | undefined,
}))

vi.mock('@hooks/useChainNameWhenMultiChain', () => ({
    useChainNameWhenMultiChain: () => mockChainName.value,
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        addressSearchPlaceholder: mockFamiliesWithPlaceholder.has(family)
            ? `placeholder.${family}`
            : undefined,
        wrongNetworkAddress: mockFamiliesWithCopy.has(family)
            ? {
                  titleKey: `title.${family}`,
                  bodyKey: `body.${family}`,
                  sendBodyKey: `send_body.${family}`,
                  sendOnNetworkBodyKey: `send_body_on_network.${family}`,
              }
            : undefined,
    }),
    chainFamilyDisplay: (family: string) => ({ label: `family.${family}` }),
}))

const ALGORAND_SCOPE: ChainScope = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
}
const ETHEREUM_SCOPE: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearchQuery: vi.fn(() => ({ data: [], isLoading: false })),
}))

const mockReadText = vi.fn(async () => '')

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ readText: mockReadText, copyToClipboard: vi.fn() }),
}))

// The global mock stubs useFocusEffect to a no-op, which would never run the
// clipboard read. Run the callback so the paste row is actually exercised.
vi.mock('@react-navigation/native', () => ({
    useFocusEffect: (callback: () => void | (() => void)) => {
        React.useEffect(callback, [callback])
    },
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const itemsOfType = (items: AddressSearchItem[], type: string) =>
    items.filter(i => i.type === type)

const mockIsValidAddress = vi.fn<(address: string) => boolean>()

// A stand-in for the Algorand codec, so each test decides what counts as valid.
beforeEach(() => {
    addressCodecs.register({
        ...fixtureCodec,
        chainId: LEGACY_CHAIN_ID,
        isValid: address => mockIsValidAddress(address),
    })
    addressCodecs.register({
        ...fixtureCodec,
        chainId: 'ethereum',
        isValid: address => mockIsValidAddress(address),
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useAddressSearchView', () => {
    const mockFindContacts = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockChainName.value = undefined

        vi.mocked(useContacts).mockReturnValue({
            findContacts: mockFindContacts,
        } as unknown as ReturnType<typeof useContacts>)

        vi.mocked(useAllAccounts).mockReturnValue([])
        vi.mocked(useSortedAccounts).mockImplementation(
            accounts =>
                ({ sortedAccounts: accounts }) as unknown as ReturnType<
                    typeof useSortedAccounts
                >,
        )
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue({
            accountValueTotals: new Map(),
        } as unknown as ReturnType<typeof useAccountValueTotalsQuery>)
        mockIsValidAddress.mockReturnValue(false)
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)
        mockFindContacts.mockReturnValue([])
        vi.mocked(addressFamilyOf).mockReturnValue(undefined)
    })

    it('initializes with empty value and no results', () => {
        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        expect(result.current.value).toBe('')
        expect(result.current.matchingItems).toEqual([])
        expect(result.current.hasResults).toBe(false)
    })

    it('returns account items with section header when accounts match', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Account 1' },
            { chains: { algorand: { address: 'DEF456' } }, name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('ABC')
        })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )

        expect(headers).toHaveLength(1)
        expect(headers[0]).toEqual(
            expect.objectContaining({
                title: 'address_entry.my_accounts',
            }),
        )
        expect(accountItems).toHaveLength(1)
        expect(result.current.hasResults).toBe(true)
    })

    it('matches an account by its custom name, not just its address', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Savings' },
            { chains: { algorand: { address: 'DEF456' } }, name: 'Spending' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('Savings')
        })

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({
                    chains: { algorand: { address: 'ABC123' } },
                }),
            }),
        )
    })

    it('excludes account matching excludeAddress', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Account 1' },
            { chains: { algorand: { address: 'DEF456' } }, name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                excludeAddress: 'ABC123',
            }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({
                    chains: { algorand: { address: 'DEF456' } },
                }),
            }),
        )
    })

    it('offers only the accounts the filter accepts', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'STD_ADDR' } },
                name: 'Standard',
                custody: { kind: 'local', seed: null },
            },
            {
                chains: { algorand: { address: 'QUANTUM_ADDR' } },
                name: 'Quantum',
                custody: { kind: 'local', seed: 'quantum' },
            },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                accountFilter: account =>
                    (account.custody as { seed?: string }).seed !== 'quantum',
            }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({
                    chains: { algorand: { address: 'STD_ADDR' } },
                }),
            }),
        )
    })

    it('returns contact items with section header when contacts match', () => {
        const contacts = [
            { addresses: { algorand: 'CONT123' }, name: 'Friend' },
        ]
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('Friend')
        })

        expect(mockFindContacts).toHaveBeenCalledWith({
            keyword: 'Friend',
            family: 'algorand',
        })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )

        expect(headers).toHaveLength(1)
        expect(headers[0]).toEqual(
            expect.objectContaining({ title: 'address_entry.contacts' }),
        )
        expect(contactItems).toHaveLength(1)
    })

    it('does not search contacts when value is empty by default', () => {
        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        expect(
            itemsOfType(result.current.matchingItems, 'contact'),
        ).toHaveLength(0)
        expect(mockFindContacts).not.toHaveBeenCalled()
    })

    it('shows all contacts when value is empty and showAllContactsWhenEmpty is true', () => {
        const contacts = [
            { addresses: { algorand: 'CONT123' }, name: 'Friend' },
            { addresses: { algorand: 'CONT456' }, name: 'Buddy' },
        ]
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                showAllContactsWhenEmpty: true,
            }),
        )

        expect(mockFindContacts).toHaveBeenCalledWith({
            keyword: '',
            family: 'algorand',
        })

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )

        expect(contactItems).toHaveLength(2)
        expect(headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'address_entry.contacts' }),
            ]),
        )
    })

    it('returns section header and foreign address item when address is valid and not in wallet', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Account 1' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockIsValidAddress.mockReturnValue(true)
        mockFindContacts.mockReturnValue([
            { addresses: { algorand: 'CONT123' }, name: 'Friend' },
        ])

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('VALID_58_CHAR_ADDRESS')
        })

        expect(result.current.matchingItems).toHaveLength(2)
        expect(result.current.matchingItems[0]).toEqual(
            expect.objectContaining({
                type: 'section_header',
                title: 'address_entry.address',
            }),
        )
        expect(result.current.matchingItems[1]).toEqual(
            expect.objectContaining({
                type: 'address',
                address: 'VALID_58_CHAR_ADDRESS',
            }),
        )
        expect(result.current.hasResults).toBe(true)
    })

    it('returns the matched wallet account when typed address is in user wallet', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'OWN_ADDRESS' } },
                name: 'My Account',
                custody: { kind: 'local', seed: null },
            },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockIsValidAddress.mockReturnValue(true)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('OWN_ADDRESS')
        })

        expect(result.current.matchingItems).toHaveLength(2)
        expect(result.current.matchingItems[1]).toEqual(
            expect.objectContaining({
                type: 'account',
                account: expect.objectContaining({
                    chains: { algorand: { address: 'OWN_ADDRESS' } },
                    name: 'My Account',
                }),
            }),
        )
    })

    it('shows all matching accounts when no value entered', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Account 1' },
            { chains: { algorand: { address: 'DEF456' } }, name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(2)
        expect(result.current.hasResults).toBe(true)
    })

    it('orders items as address, accounts, then contacts', () => {
        const accounts = [
            { chains: { algorand: { address: 'ABC123' } }, name: 'Account 1' },
        ]
        const contacts = [
            { addresses: { algorand: 'CONT123' }, name: 'Friend' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('C')
        })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        expect(headers[0]).toEqual(
            expect.objectContaining({
                title: 'address_entry.my_accounts',
            }),
        )
        expect(headers[1]).toEqual(
            expect.objectContaining({
                title: 'address_entry.contacts',
            }),
        )
    })

    it('excludes a contact whose address is already a wallet account', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'SHARED_ADDR' } },
                name: 'My Account',
            },
        ]
        const contacts = [
            { addresses: { algorand: 'SHARED_ADDR' }, name: 'Same As Account' },
            { addresses: { algorand: 'CONT_ONLY' }, name: 'Contact Only' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                showAllContactsWhenEmpty: true,
            }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )

        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({
                    chains: { algorand: { address: 'SHARED_ADDR' } },
                }),
            }),
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                address: 'CONT_ONLY',
            }),
        )
    })

    it('excludes a contact whose address is a wallet account even when searching by contact name', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'OWN_ADDR_XYZ' } },
                name: 'My Account',
            },
        ]
        const contacts = [
            { addresses: { algorand: 'OWN_ADDR_XYZ' }, name: 'Alice' },
            { addresses: { algorand: 'CONT_ONLY' }, name: 'Alice Other' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('Alice')
        })

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                address: 'CONT_ONLY',
            }),
        )
    })

    it('excludes a contact whose address matches excludeAddress', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'OWN_ADDR_XYZ' } },
                name: 'My Account',
            },
        ]
        const contacts = [
            { addresses: { algorand: 'OWN_ADDR_XYZ' }, name: 'Me' },
            { addresses: { algorand: 'CONT_ONLY' }, name: 'Someone Else' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                excludeAddress: 'OWN_ADDR_XYZ',
                showAllContactsWhenEmpty: true,
            }),
        )

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                address: 'CONT_ONLY',
            }),
        )
    })

    it('excludes and selects contacts by their address in the requested family', () => {
        const accounts = [
            {
                chains: { algorand: { address: 'OWN_ADDR' } },
                name: 'My Account',
            },
        ]
        const contacts = [
            {
                addresses: {
                    algorand: 'OWN_ADDR',
                    evm: 'OTHER_ADDR',
                } as ContactAddresses,
                name: 'Two Chains',
            },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ETHEREUM_SCOPE,
                showAllContactsWhenEmpty: true,
            }),
        )

        expect(mockFindContacts).toHaveBeenCalledWith({
            keyword: '',
            family: 'evm',
        })
        expect(itemsOfType(result.current.matchingItems, 'contact')).toEqual([
            expect.objectContaining({ address: 'OTHER_ADDR' }),
        ])
    })

    it("offers only the accounts with an address on the scope's chain", () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            { chains: { algorand: { address: 'ALGO_ADDR' } }, name: 'Algo' },
            { chains: { ethereum: { address: '0xETH' } }, name: 'Eth' },
        ] as unknown as ReturnType<typeof useAllAccounts>)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ETHEREUM_SCOPE }),
        )

        expect(
            itemsOfType(result.current.matchingItems, 'account').map(
                item => (item as { account: { name: string } }).account.name,
            ),
        ).toEqual(['Eth'])
    })

    it('returns NFD results when value contains a dot', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [
                {
                    name: 'alice.algo',
                    address: 'NFD_RESOLVED_ADDR',
                    service: { name: 'NFD', logo: '' },
                },
            ],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('alice.algo')
        })

        const nfdItems = itemsOfType(result.current.matchingItems, 'nfd')
        expect(nfdItems).toHaveLength(1)
        expect(nfdItems[0]).toEqual(
            expect.objectContaining({
                type: 'nfd',
                nfd: expect.objectContaining({ name: 'alice.algo' }),
            }),
        )

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        expect(headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    title: 'address_entry.nfd_results',
                }),
            ]),
        )
    })

    it('does not search NFD when value has no dot', () => {
        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('alice')
        })

        expect(vi.mocked(useNfdSearchQuery)).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ enabled: false }),
        )

        const nfdItems = itemsOfType(result.current.matchingItems, 'nfd')
        expect(nfdItems).toHaveLength(0)
    })

    it('exposes isNfdLoading state', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: true,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() =>
            useAddressSearchView({ scope: ALGORAND_SCOPE }),
        )

        act(() => {
            result.current.setValue('alice.algo')
        })

        expect(result.current.isNfdLoading).toBe(true)
    })

    describe('paste from clipboard', () => {
        it('offers the clipboard address as the first row when it is a valid address', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            mockIsValidAddress.mockImplementation(
                addr =>
                    addr ===
                    'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )

            const { result } = renderHook(() =>
                useAddressSearchView({
                    scope: ALGORAND_SCOPE,
                    showClipboardPaste: true,
                }),
            )

            await waitFor(() => {
                expect(
                    itemsOfType(result.current.matchingItems, 'paste'),
                ).toHaveLength(1)
            })
            expect(result.current.matchingItems[0]).toEqual(
                expect.objectContaining({
                    type: 'paste',
                    address:
                        'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
                }),
            )
        })

        it('ignores clipboard contents that are not an address', async () => {
            mockReadText.mockResolvedValue('just some copied text')
            mockIsValidAddress.mockReturnValue(false)

            const { result } = renderHook(() =>
                useAddressSearchView({
                    scope: ALGORAND_SCOPE,
                    showClipboardPaste: true,
                }),
            )

            await waitFor(() => expect(mockReadText).toHaveBeenCalled())
            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(0)
        })

        // Opt-in so the multisig add-participant sheet does not read the
        // clipboard (and trigger iOS's paste notice) just by mounting.
        it('does not read the clipboard unless asked to', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            mockIsValidAddress.mockReturnValue(true)

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ALGORAND_SCOPE }),
            )

            expect(mockReadText).not.toHaveBeenCalled()
            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(0)
        })

        it('keeps offering the paste row while the user types', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            mockIsValidAddress.mockImplementation(
                addr =>
                    addr ===
                    'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )

            const { result } = renderHook(() =>
                useAddressSearchView({
                    scope: ALGORAND_SCOPE,
                    showClipboardPaste: true,
                }),
            )
            await waitFor(() => {
                expect(
                    itemsOfType(result.current.matchingItems, 'paste'),
                ).toHaveLength(1)
            })

            act(() => {
                result.current.setValue('ali')
            })

            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(1)
        })
    })

    describe('account ordering', () => {
        const storeOrder = [
            { chains: { algorand: { address: 'ZEBRA1' } }, name: 'Zebra' },
            { chains: { algorand: { address: 'APPLE1' } }, name: 'Apple' },
        ]

        const mockSortedAs = (accounts: typeof storeOrder) =>
            vi.mocked(useSortedAccounts).mockReturnValue({
                sortedAccounts: accounts,
            } as unknown as ReturnType<typeof useSortedAccounts>)

        it('lists accounts in the sorted order, not the raw store order', () => {
            vi.mocked(useAllAccounts).mockReturnValue(
                storeOrder as unknown as ReturnType<typeof useAllAccounts>,
            )
            mockSortedAs([storeOrder[1]!, storeOrder[0]!])

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ALGORAND_SCOPE }),
            )

            expect(
                itemsOfType(result.current.matchingItems, 'account').map(
                    item =>
                        (item as { account: WalletAccount }).account.chains
                            .algorand?.address,
                ),
            ).toEqual(['APPLE1', 'ZEBRA1'])
        })

        it('keeps the sorted order once a search narrows the list', () => {
            const accounts = [
                {
                    chains: { algorand: { address: 'ZEBRA1' } },
                    name: 'Shared Zebra',
                },
                {
                    chains: { algorand: { address: 'APPLE1' } },
                    name: 'Shared Apple',
                },
                {
                    chains: { algorand: { address: 'OTHER1' } },
                    name: 'Unrelated',
                },
            ]
            vi.mocked(useAllAccounts).mockReturnValue(
                accounts as unknown as ReturnType<typeof useAllAccounts>,
            )
            mockSortedAs([accounts[1]!, accounts[0]!, accounts[2]!])

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ALGORAND_SCOPE }),
            )

            act(() => {
                result.current.setValue('Shared')
            })

            expect(
                itemsOfType(result.current.matchingItems, 'account').map(
                    item =>
                        (item as { account: WalletAccount }).account.chains
                            .algorand?.address,
                ),
            ).toEqual(['APPLE1', 'ZEBRA1'])
        })
    })

    describe('address from another network', () => {
        const EVM_ADDRESS = '0xb0c164986d5d753a88455d5dbf82541573d21d48'
        const ALGORAND_ADDRESS =
            'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN'

        it('flags an EVM address entered for an Algorand chain and offers nothing to select', async () => {
            vi.mocked(useAllAccounts).mockReturnValue([
                { chains: { algorand: { address: 'ABC123' } }, name: '0xb0c1' },
            ] as unknown as ReturnType<typeof useAllAccounts>)
            mockFindContacts.mockReturnValue([
                { addresses: { algorand: 'CONT123' }, name: '0xb0c1' },
            ])
            mockReadText.mockResolvedValue(ALGORAND_ADDRESS)
            mockIsValidAddress.mockImplementation(
                addr => addr === ALGORAND_ADDRESS,
            )
            vi.mocked(addressFamilyOf).mockImplementation(addr =>
                addr === EVM_ADDRESS
                    ? { family: 'evm', address: EVM_ADDRESS }
                    : undefined,
            )

            const { result } = renderHook(() =>
                useAddressSearchView({
                    scope: ALGORAND_SCOPE,
                    showClipboardPaste: true,
                }),
            )
            await waitFor(() => {
                expect(
                    itemsOfType(result.current.matchingItems, 'paste'),
                ).toHaveLength(1)
            })

            act(() => {
                result.current.setValue(EVM_ADDRESS)
            })

            expect(result.current.mismatchedFamily).toBe('evm')
            expect(result.current.matchingItems).toEqual([])
            expect(result.current.hasResults).toBe(false)
        })

        it('flags an Algorand address entered for an EVM chain', () => {
            vi.mocked(addressFamilyOf).mockReturnValue({
                family: 'algorand',
                address: ALGORAND_ADDRESS,
            })

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )

            act(() => {
                result.current.setValue(ALGORAND_ADDRESS)
            })

            expect(result.current.mismatchedFamily).toBe('algorand')
            expect(result.current.hasResults).toBe(false)
        })

        it("does not flag an address in the scope's own family", () => {
            vi.mocked(useAllAccounts).mockReturnValue([
                {
                    chains: { ethereum: { address: EVM_ADDRESS } },
                    name: 'Main',
                },
            ] as unknown as ReturnType<typeof useAllAccounts>)
            vi.mocked(addressFamilyOf).mockReturnValue({
                family: 'evm',
                address: EVM_ADDRESS,
            })

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )

            act(() => {
                result.current.setValue(EVM_ADDRESS)
            })

            expect(result.current.mismatchedFamily).toBeUndefined()
            expect(
                itemsOfType(result.current.matchingItems, 'account'),
            ).toHaveLength(1)
        })

        describe('message', () => {
            const enterEvmAddress = (
                props: Partial<Parameters<typeof useAddressSearchView>[0]>,
            ) => {
                vi.mocked(addressFamilyOf).mockReturnValue({
                    family: 'evm',
                    address: EVM_ADDRESS,
                })
                const { result } = renderHook(() =>
                    useAddressSearchView({ scope: ALGORAND_SCOPE, ...props }),
                )
                act(() => {
                    result.current.setValue(EVM_ADDRESS)
                })
                return result.current.wrongNetworkMessage
            }

            afterEach(() => {
                mockFamiliesWithCopy.add('evm')
            })

            it("titles the address's network and keeps the body neutral when nothing is sent", () => {
                expect(enterEvmAddress({})).toEqual({
                    title: 'title.evm',
                    body: 'body.algorand',
                })
            })

            it("names the sent asset and points at the address's family", () => {
                expect(
                    enterEvmAddress({ sendingAssetLabel: 'ALGO' })?.body,
                ).toBe(
                    `send_body.algorand ${JSON.stringify({
                        asset: 'ALGO',
                        network: 'Algorand',
                        family: 'family.evm',
                    })}`,
                )
            })

            it('names the network of an asset found on several chains', () => {
                expect(
                    enterEvmAddress({
                        sendingAssetLabel: 'USDC',
                        isSendingMultiChainAsset: true,
                    })?.body,
                ).toMatch(/^send_body_on_network\.algorand /)
            })

            it('has no message when a family registers no copy, so the search miss shows', () => {
                mockFamiliesWithCopy.delete('evm')

                expect(enterEvmAddress({})).toBeUndefined()
            })
        })

        it('does not flag input that is no address at all', () => {
            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ALGORAND_SCOPE }),
            )

            act(() => {
                result.current.setValue('0xnot-an-address')
            })

            expect(result.current.mismatchedFamily).toBeUndefined()
        })
    })

    describe('search placeholder', () => {
        beforeEach(() => {
            mockFamiliesWithPlaceholder.clear()
            mockFamiliesWithPlaceholder.add('algorand')
            mockFamiliesWithPlaceholder.add('evm')
        })

        it("is the scope family's own copy", () => {
            const algorand = renderHook(() =>
                useAddressSearchView({ scope: ALGORAND_SCOPE }),
            )
            const evm = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )

            expect(algorand.result.current.searchPlaceholder).toBe(
                'placeholder.algorand',
            )
            expect(evm.result.current.searchPlaceholder).toBe('placeholder.evm')
        })

        it('falls back to neutral copy for a family with no placeholder', () => {
            mockFamiliesWithPlaceholder.delete('evm')

            const { result } = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )

            expect(result.current.searchPlaceholder).toBe(
                'address_entry.search_placeholder_neutral',
            )
        })
    })

    describe('chain badge', () => {
        it('names the chain only when the wallet says to', () => {
            mockChainName.value = 'Ethereum'
            const named = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )
            mockChainName.value = undefined
            const unnamed = renderHook(() =>
                useAddressSearchView({ scope: ETHEREUM_SCOPE }),
            )

            expect(named.result.current.chainBadgeName).toBe('Ethereum')
            expect(unnamed.result.current.chainBadgeName).toBeUndefined()
        })
    })

    it('still offers the excluded address when the user enters it', () => {
        const sender = {
            chains: { algorand: { address: 'SENDER_ADDR' } },
            name: 'Sender',
        }
        vi.mocked(useAllAccounts).mockReturnValue([
            sender,
        ] as unknown as ReturnType<typeof useAllAccounts>)
        mockIsValidAddress.mockImplementation(a => a === 'SENDER_ADDR')

        const { result } = renderHook(() =>
            useAddressSearchView({
                scope: ALGORAND_SCOPE,
                excludeAddress: 'SENDER_ADDR',
            }),
        )
        act(() => {
            result.current.setValue('SENDER_ADDR')
        })

        expect(itemsOfType(result.current.matchingItems, 'account')).toEqual([
            expect.objectContaining({ account: sender }),
        ])
    })
})
