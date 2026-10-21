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

import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useContactForm } from '../useContactForm'

const ALGORAND_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const OTHER_ALGORAND_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const EVM_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const CHECKSUMMED_EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const ALICE: Contact = {
    id: 'alice-id',
    name: 'Alice',
    addresses: { algorand: ALGORAND_ADDRESS },
}

const mocks = vi.hoisted(() => ({ contacts: [] as Contact[] }))

// Override the global vitest-setup mock so contactSchema (used by the hook's
// zod resolver) and family inference come from the real module.
vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: vi.fn(() => ({
            contacts: mocks.contacts,
            findContacts: vi.fn(() => []),
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
            selectedContact: null,
            setSelectedContact: vi.fn(),
        })),
    }
})

vi.mock('@hooks/useImagePicker', () => ({
    useImagePicker: () => ({
        pickFromGallery: vi.fn().mockResolvedValue(null),
    }),
}))

vi.mock('@hooks/useNfdResolve', () => ({
    useNfdResolve: () => ({
        resolvedAddress: '',
        isNfdResolved: false,
        isNfdResolving: false,
        nfdName: undefined,
    }),
}))

beforeEach(() => {
    mocks.contacts = [ALICE]
    registerAlgorandAddressCodec()
    registerEthereumChain()
})

afterEach(() => {
    restoreAlgorandOnlyChains()
})

describe('useContactForm', () => {
    it('opens with the address field and no rows for a new contact', () => {
        const { result } = renderHook(() => useContactForm(null))

        expect(result.current.addressRows).toEqual([])
        expect(result.current.isAddressInputVisible).toBe(true)
        expect(result.current.isValid).toBe(false)
    })

    it('seeds one row per family the contact holds and hides the field', () => {
        const { result } = renderHook(() =>
            useContactForm({
                ...ALICE,
                addresses: { algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS },
            }),
        )

        expect(result.current.addressRows.map(({ family }) => family)).toEqual([
            'algorand',
            'evm',
        ])
        expect(result.current.isAddressInputVisible).toBe(false)
    })

    it('files a pasted 0x address under the EVM family, checksummed, without the user picking one', () => {
        const { result } = renderHook(() => useContactForm(null))

        act(() => result.current.onAddressInputChange(` ${EVM_ADDRESS} `))

        expect(result.current.addresses).toEqual({
            evm: CHECKSUMMED_EVM_ADDRESS,
        })
        expect(result.current.rawAddressInput).toBe('')
        expect(result.current.isAddressInputVisible).toBe(false)
    })

    it('files an Algorand address under the Algorand family', () => {
        const { result } = renderHook(() => useContactForm(null))

        act(() => result.current.onAddressInputChange(ALGORAND_ADDRESS))

        expect(result.current.addresses).toEqual({
            algorand: ALGORAND_ADDRESS,
        })
    })

    it('marks input no family accepts as invalid and adds nothing', () => {
        const { result } = renderHook(() => useContactForm(null))

        act(() => result.current.onAddressInputChange('not-an-address'))

        expect(result.current.isAddressInputInvalid).toBe(true)
        expect(result.current.addresses).toEqual({})
    })

    it('adds a second family next to the first', () => {
        const { result } = renderHook(() => useContactForm(ALICE))

        act(() => result.current.showAddressInput())
        act(() => result.current.onAddressInputChange(EVM_ADDRESS))

        expect(result.current.addresses).toEqual({
            algorand: ALGORAND_ADDRESS,
            evm: CHECKSUMMED_EVM_ADDRESS,
        })
    })

    it('asks before replacing the address a family already holds, and replaces it on confirm', () => {
        const { result } = renderHook(() => useContactForm(ALICE))

        act(() => result.current.showAddressInput())
        act(() => result.current.onAddressInputChange(OTHER_ALGORAND_ADDRESS))

        expect(result.current.pendingReplacement).toEqual({
            family: 'algorand',
            address: OTHER_ALGORAND_ADDRESS,
        })
        expect(result.current.addresses.algorand).toBe(ALGORAND_ADDRESS)

        act(() => result.current.confirmReplacement())

        expect(result.current.addresses.algorand).toBe(OTHER_ALGORAND_ADDRESS)
        expect(result.current.pendingReplacement).toBeUndefined()
    })

    it('keeps the held address when the replacement is cancelled', () => {
        const { result } = renderHook(() => useContactForm(ALICE))

        act(() => result.current.showAddressInput())
        act(() => result.current.onAddressInputChange(OTHER_ALGORAND_ADDRESS))
        act(() => result.current.cancelReplacement())

        expect(result.current.addresses.algorand).toBe(ALGORAND_ADDRESS)
        expect(result.current.pendingReplacement).toBeUndefined()
        expect(result.current.rawAddressInput).toBe('')
    })

    it('does not ask when the same address is entered again', () => {
        const { result } = renderHook(() => useContactForm(ALICE))

        act(() => result.current.showAddressInput())
        act(() => result.current.onAddressInputChange(ALGORAND_ADDRESS))

        expect(result.current.pendingReplacement).toBeUndefined()
    })

    it('removes a family, and reopens the field once none is left', () => {
        const { result } = renderHook(() =>
            useContactForm({
                ...ALICE,
                addresses: { algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS },
            }),
        )

        act(() => result.current.removeAddress('evm'))

        expect(result.current.addresses).toEqual({
            algorand: ALGORAND_ADDRESS,
        })

        act(() => result.current.removeAddress('algorand'))

        expect(result.current.addressRows).toEqual([])
        expect(result.current.isAddressInputVisible).toBe(true)
    })

    it('flags a row whose address another contact holds in that family', () => {
        mocks.contacts = [
            ALICE,
            {
                id: 'bob-id',
                name: 'Bob',
                addresses: { evm: CHECKSUMMED_EVM_ADDRESS },
            },
        ]
        const { result } = renderHook(() =>
            useContactForm({
                ...ALICE,
                addresses: { algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS },
            }),
        )

        expect(result.current.addressRows).toEqual([
            {
                family: 'algorand',
                address: ALGORAND_ADDRESS,
                isDuplicate: false,
            },
            { family: 'evm', address: EVM_ADDRESS, isDuplicate: true },
        ])
    })
})
