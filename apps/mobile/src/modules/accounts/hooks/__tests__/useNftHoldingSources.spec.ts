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

import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { registerEthereumChain } from '@test-utils/chain-fixtures'

import { useNftHoldingSources } from '../useNftHoldingSources'

const ETH_ADDRESS = `0x${'f'.repeat(40)}`

const TWO_CHAIN_ACCOUNT: WalletAccount = {
    id: 'both',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'ALGO' },
        ethereum: { address: ETH_ADDRESS },
    },
}

const chainsOf = (sources: { scope: { chainId: string } }[]) =>
    sources.map(({ scope }) => scope.chainId)

describe('useNftHoldingSources', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        registerEthereumChain()
    })

    it('keeps only the sources on chains with nft on', () => {
        act(() => setCapabilityOverrides({ nft: false }, 'ethereum'))

        const { result } = renderHook(() =>
            useNftHoldingSources(TWO_CHAIN_ACCOUNT),
        )

        expect(chainsOf(result.current)).toEqual(['algorand'])
        expect(result.current[0]?.address).toBe('ALGO')
    })

    it('is empty when nft is overridden off on every chain it holds on', () => {
        act(() => {
            setCapabilityOverrides({ nft: false })
            setCapabilityOverrides({ nft: false }, 'ethereum')
        })

        const { result } = renderHook(() =>
            useNftHoldingSources(TWO_CHAIN_ACCOUNT),
        )

        expect(result.current).toEqual([])
    })

    it('lists every nft chain the account holds on', () => {
        const { result } = renderHook(() =>
            useNftHoldingSources(TWO_CHAIN_ACCOUNT),
        )

        expect(chainsOf(result.current)).toEqual(['algorand', 'ethereum'])
    })

    it('is empty without an account', () => {
        const { result } = renderHook(() => useNftHoldingSources(null))

        expect(result.current).toEqual([])
    })
})
