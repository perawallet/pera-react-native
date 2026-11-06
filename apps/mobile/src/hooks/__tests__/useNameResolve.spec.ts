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
import {
    nameServiceOf,
    useNameResolutionQuery,
    verifyNameAddress,
} from '@perawallet/wallet-core-nfd'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { useNameResolve } from '../useNameResolve'

const { network } = vi.hoisted(() => ({ network: { id: 'mainnet' } }))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNameResolutionQuery: vi.fn(),
    verifyNameAddress: vi.fn(),
    nameServiceOf: vi.fn((scope: { chainId: string }) =>
        scope.chainId === 'algorand' ? 'nfd' : 'ens',
    ),
}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck: () => () => true,
    useSelectedScopes: (chainIds: string[]) =>
        chainIds.map(chainId => ({ chainId, networkId: network.id })),
}))
// Ethereum is the default of the EVM chains, as in the registry.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    preferDefaultChain: (chainIds: string[]) =>
        chainIds.find(chainId => chainId === 'ethereum') ?? chainIds[0],
}))

const ALGORAND_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
const NFD_ADDRESS = 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'
const ENS_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const FIXTURE_ADDRESS = `fx${'a'.repeat(40)}`
const CHAIN_IDS = ['algorand', 'base', 'ethereum'] as never

const mockSearch = (data?: { name: string; address: string }) => {
    vi.mocked(useNameResolutionQuery).mockReturnValue({
        data,
        isLoading: false,
    } as unknown as ReturnType<typeof useNameResolutionQuery>)
}

const scopesSearched = () =>
    vi.mocked(useNameResolutionQuery).mock.lastCall?.[0]

describe('useNameResolve', () => {
    beforeEach(() => {
        registerAlgorandAddressCodec()
        addressCodecs.register(fixtureCodec)
        mockSearch()
        network.id = 'mainnet'
    })

    afterEach(() => {
        addressCodecs.reset()
        vi.clearAllMocks()
    })

    it('returns an Algorand address as typed, without searching', () => {
        const { result } = renderHook(() =>
            useNameResolve(ALGORAND_ADDRESS, CHAIN_IDS),
        )

        expect(result.current.isDirectAddress).toBe(true)
        expect(result.current.resolvedAddress).toBe(ALGORAND_ADDRESS)
        expect(useNameResolutionQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            ALGORAND_ADDRESS,
            { enabled: false },
        )
    })

    it("returns an address another registered chain's codec accepts as typed", () => {
        const { result } = renderHook(() =>
            useNameResolve(FIXTURE_ADDRESS, CHAIN_IDS),
        )

        expect(result.current.isDirectAddress).toBe(true)
        expect(result.current.resolvedAddress).toBe(FIXTURE_ADDRESS)
        expect(result.current.isNameResolved).toBe(false)
    })

    it('resolves an NFD name and searches Algorand', () => {
        mockSearch({ name: 'alice.algo', address: NFD_ADDRESS })

        const { result } = renderHook(() =>
            useNameResolve('alice.algo', CHAIN_IDS),
        )

        expect(useNameResolutionQuery).toHaveBeenLastCalledWith(
            expect.arrayContaining([
                { chainId: 'algorand', networkId: 'mainnet' },
            ]),
            'alice.algo',
            { enabled: true },
        )
        expect(result.current.isDirectAddress).toBe(false)
        expect(result.current.isNameResolved).toBe(true)
        expect(result.current.resolvedAddress).toBe(NFD_ADDRESS)
        expect(result.current.resolvedName).toBe('alice.algo')
    })

    it('resolves an ENS name through the default EVM chain only', () => {
        mockSearch({ name: 'alice.eth', address: ENS_ADDRESS })

        const { result } = renderHook(() =>
            useNameResolve('alice.eth', CHAIN_IDS),
        )

        expect(scopesSearched()).toEqual([
            { chainId: 'algorand', networkId: 'mainnet' },
            { chainId: 'ethereum', networkId: 'mainnet' },
        ])
        expect(result.current.isNameResolved).toBe(true)
        expect(result.current.resolvedAddress).toBe(ENS_ADDRESS)
    })

    it("searches the selected network's scope, so testnet reads Sepolia's record", () => {
        network.id = 'sepolia'

        renderHook(() => useNameResolve('alice.eth', CHAIN_IDS))

        expect(scopesSearched()).toContainEqual({
            chainId: 'ethereum',
            networkId: 'sepolia',
        })
    })

    it('never checks a name on-chain, however it resolves', () => {
        mockSearch({ name: 'alice.eth', address: ENS_ADDRESS })

        renderHook(() => useNameResolve('alice.eth', CHAIN_IDS))

        expect(verifyNameAddress).not.toHaveBeenCalled()
        expect(nameServiceOf).toHaveBeenCalled()
    })

    it('resolves to nothing for input that is neither an address nor a name', () => {
        const { result } = renderHook(() =>
            useNameResolve('not-an-address', CHAIN_IDS),
        )

        expect(result.current.isDirectAddress).toBe(false)
        expect(result.current.isNameResolved).toBe(false)
        expect(result.current.resolvedAddress).toBe('')
    })

    it('reports an unresolvable name as unresolved with no address', () => {
        const { result } = renderHook(() =>
            useNameResolve('nobody.eth', CHAIN_IDS),
        )

        expect(result.current.isNameResolved).toBe(false)
        expect(result.current.resolvedAddress).toBe('')
    })
})
