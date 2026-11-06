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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useContactAddressName } from '../useContactAddressName'

const mocks = vi.hoisted(() => ({
    useNameForAddressQuery: vi.fn(),
    nameServiceOf: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNameForAddressQuery: mocks.useNameForAddressQuery,
    nameServiceOf: mocks.nameServiceOf,
}))

describe('useContactAddressName', () => {
    beforeEach(() => {
        registerEthereumChain()
        mocks.nameServiceOf.mockImplementation((scope: { chainId: string }) =>
            scope.chainId === ETHEREUM_CHAIN_ID ? 'ens' : 'nfd',
        )
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
        vi.clearAllMocks()
    })

    it("names an Ethereum address with its ENS name on the chain's selected scope", () => {
        mocks.useNameForAddressQuery.mockReturnValue({
            data: [{ name: 'alice.eth' }, { name: 'second.eth' }],
        })

        const { result } = renderHook(() =>
            useContactAddressName('0xA11CE', ETHEREUM_CHAIN_ID),
        )

        expect(result.current).toEqual({
            name: 'alice.eth',
            labelKey: 'contacts.view_contact.ens_label',
        })
        expect(mocks.useNameForAddressQuery).toHaveBeenCalledWith(
            getSelectedScope(ETHEREUM_CHAIN_ID),
            '0xA11CE',
        )
    })

    it('labels an Algorand name as an NFDomain', () => {
        mocks.useNameForAddressQuery.mockReturnValue({
            data: [{ name: 'alice.algo' }],
        })

        const { result } = renderHook(() =>
            useContactAddressName('ALICE_ADDRESS', 'algorand'),
        )

        expect(result.current).toEqual({
            name: 'alice.algo',
            labelKey: 'contacts.view_contact.nfd_label',
        })
    })

    it('has no name when the lookup returns none', () => {
        mocks.useNameForAddressQuery.mockReturnValue({ data: [] })

        const { result } = renderHook(() =>
            useContactAddressName('0xA11CE', ETHEREUM_CHAIN_ID),
        )

        expect(result.current.name).toBeUndefined()
    })
})
