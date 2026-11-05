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

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { nameServiceOf, useNameSearchQuery } from '@perawallet/wallet-core-nfd'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { useNfdResolve } from '../useNfdResolve'

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNameSearchQuery: vi.fn(),
    nameServiceOf: vi.fn(() => 'nfd'),
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const ALGORAND_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
const NFD_ADDRESS = 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'
const FIXTURE_ADDRESS = `fx${'a'.repeat(40)}`

const mockSearch = (data: { name: string; address: string }[] = []) => {
    vi.mocked(useNameSearchQuery).mockReturnValue({
        data,
        isLoading: false,
    } as unknown as ReturnType<typeof useNameSearchQuery>)
}

describe('useNfdResolve', () => {
    beforeEach(() => {
        registerAlgorandAddressCodec()
        addressCodecs.register(fixtureCodec)
        mockSearch()
        vi.mocked(nameServiceOf).mockReturnValue('nfd')
    })

    afterEach(() => {
        addressCodecs.reset()
        vi.clearAllMocks()
    })

    it('returns an Algorand address as typed, without searching NFD', () => {
        const { result } = renderHook(() =>
            useNfdResolve(ALGORAND_ADDRESS, SCOPE),
        )

        expect(result.current.isDirectAddress).toBe(true)
        expect(result.current.resolvedAddress).toBe(ALGORAND_ADDRESS)
        expect(useNameSearchQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ chainId: 'algorand' }),
            ALGORAND_ADDRESS,
            { enabled: false },
        )
    })

    it("returns an address another registered chain's codec accepts as typed", () => {
        const { result } = renderHook(() =>
            useNfdResolve(FIXTURE_ADDRESS, SCOPE),
        )

        expect(result.current.isDirectAddress).toBe(true)
        expect(result.current.resolvedAddress).toBe(FIXTURE_ADDRESS)
        expect(result.current.isNfdResolved).toBe(false)
    })

    it('resolves a name through the NFD search', () => {
        mockSearch([{ name: 'alice.algo', address: NFD_ADDRESS }])

        const { result } = renderHook(() => useNfdResolve('alice.algo', SCOPE))

        expect(useNameSearchQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ chainId: 'algorand' }),
            'alice.algo',
            { enabled: true },
        )
        expect(result.current.isDirectAddress).toBe(false)
        expect(result.current.isNfdResolved).toBe(true)
        expect(result.current.resolvedAddress).toBe(NFD_ADDRESS)
        expect(result.current.nfdName).toBe('alice.algo')
    })

    it('does not search a chain whose names are ENS, which only a send checks on-chain', () => {
        vi.mocked(nameServiceOf).mockReturnValue('ens')

        renderHook(() => useNfdResolve('alice.eth', SCOPE))

        expect(useNameSearchQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            'alice.eth',
            { enabled: false },
        )
    })

    it('resolves to nothing for input that is neither an address nor a name', () => {
        const { result } = renderHook(() =>
            useNfdResolve('not-an-address', SCOPE),
        )

        expect(result.current.isDirectAddress).toBe(false)
        expect(result.current.isNfdResolved).toBe(false)
        expect(result.current.resolvedAddress).toBe('')
    })
})
