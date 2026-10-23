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
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useWatchableChainIds } from '../useWatchableChainIds'

const watchAccountsOff = vi.hoisted(() => new Set<string>())

vi.mock('@hooks/useCapability', () => ({
    useCapabilityCheck:
        () =>
        ({ chain }: { chain?: { chainId: string } }) =>
            chain === undefined || !watchAccountsOff.has(chain.chainId),
}))

describe('useWatchableChainIds', () => {
    beforeEach(() => {
        registerAlgorandAddressCodec()
        watchAccountsOff.clear()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
        addressCodecs.reset()
    })

    it('lists every registered chain with a codec that can watch accounts', () => {
        registerEthereumChain()

        const { result } = renderHook(() => useWatchableChainIds())

        expect(result.current).toEqual(
            expect.arrayContaining(['algorand', ETHEREUM_CHAIN_ID]),
        )
    })

    it('leaves out a chain whose watchAccounts capability is off', () => {
        registerEthereumChain()
        watchAccountsOff.add('algorand')

        const { result } = renderHook(() => useWatchableChainIds())

        expect(result.current).toEqual([ETHEREUM_CHAIN_ID])
    })

    it('leaves out a registered chain with no address codec', () => {
        getProvider().chains.register(
            fixtureEthereumDescriptor,
            allCapabilities(true),
        )

        const { result } = renderHook(() => useWatchableChainIds())

        expect(result.current).toEqual(['algorand'])
    })
})
