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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useIsCrossChainSwapEnabled } from '@hooks/useIsCrossChainSwapEnabled'
import { useSwapDestinationScopes } from '../useSwapDestinationScopes'

vi.mock('@hooks/useIsCrossChainSwapEnabled', () => ({
    useIsCrossChainSwapEnabled: vi.fn(() => true),
}))

const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const account = (
    id: string,
    chains: WalletAccount['chains'],
    custody: WalletAccount['custody'] = { kind: 'local', seed: null },
): WalletAccount => ({ id, custody, chains })

const ALGO_ONLY = account('algo', {
    algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
})
const TWO_CHAIN = account('both', {
    algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
    ethereum: { address: '0xETH', keyPairId: 'k2' },
})
const ETH_WATCH = account(
    'watch',
    { ethereum: { address: '0xWATCH' } },
    { kind: 'watch' },
)

describe('useSwapDestinationScopes', () => {
    beforeEach(() => {
        vi.mocked(useIsCrossChainSwapEnabled).mockReturnValue(true)
        // Signs on a chain where it holds a key there.
        vi.mocked(canSignWith).mockImplementation(
            (candidate: WalletAccount, _accounts, chainId: ChainId) =>
                !!candidate.chains[chainId]?.keyPairId,
        )
    })

    it('keeps the swap scope alone when the flag is off', () => {
        vi.mocked(useIsCrossChainSwapEnabled).mockReturnValue(false)
        vi.mocked(useAllAccounts).mockReturnValue([TWO_CHAIN])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(TWO_CHAIN, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE])
    })

    it('skips a chain the accounts have no address on, even where their custody could sign', () => {
        vi.mocked(canSignWith).mockReturnValue(true)
        vi.mocked(useAllAccounts).mockReturnValue([ALGO_ONLY])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(ALGO_ONLY, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE])
    })

    it('keeps the swap scope alone when no account can receive on another chain', () => {
        vi.mocked(useAllAccounts).mockReturnValue([ALGO_ONLY])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(ALGO_ONLY, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE])
    })

    it("adds Ethereum's selected network when an own account signs there", () => {
        vi.mocked(useAllAccounts).mockReturnValue([ALGO_ONLY, TWO_CHAIN])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(ALGO_ONLY, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE, ETH_SCOPE])
    })

    it('keeps a shared source account on its own chain', () => {
        const shared = account(
            'shared',
            { algorand: { address: 'MSIG' } },
            { kind: 'multisig' } as WalletAccount['custody'],
        )
        vi.mocked(useAllAccounts).mockReturnValue([shared, TWO_CHAIN])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(shared, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE])
    })

    it('does not count a watch-only Ethereum account', () => {
        vi.mocked(useAllAccounts).mockReturnValue([ALGO_ONLY, ETH_WATCH])

        const { result } = renderHook(() =>
            useSwapDestinationScopes(ALGO_ONLY, ALGO_SCOPE),
        )

        expect(result.current).toEqual([ALGO_SCOPE])
    })
})
