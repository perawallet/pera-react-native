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

import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@test-utils/render'
import {
    useAccountCapabilityScope,
    useAccountChainOptionsResolver,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import {
    rampChainAdapters,
    useOnrampStore,
} from '@perawallet/wallet-core-onramp'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'
import { useOnrampAccount } from '../useOnrampAccount'

const onBoth: WalletAccount = {
    id: 'both',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: 'ALGORAND_ADDRESS' },
        ethereum: { address: '0xabc' },
    },
}

const onEthereumOnly: WalletAccount = {
    id: 'eth',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: '0xdef' } },
}

describe('useOnrampAccount', () => {
    beforeEach(async () => {
        // The global mocks have every capability on and no chain options; the
        // chain choice needs the real capability scope and the chains an account is on.
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-accounts')
        >('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountCapabilityScope).mockImplementation(
            actual.useAccountCapabilityScope,
        )
        vi.mocked(useAccountChainOptionsResolver).mockImplementation(
            capability => {
                const check = useChainCapabilityCheck()
                return account =>
                    Object.keys(account.chains)
                        .map(chainId => ({
                            chainId: chainId as 'algorand' | 'ethereum',
                            isEnabled: true,
                        }))
                        .filter(option =>
                            check({
                                chain: {
                                    chainId: option.chainId,
                                    capability,
                                },
                            }),
                        )
            },
        )
        registerEthereumChain()
        useRemoteConfigStore.getState().resetState()
        useOnrampStore.getState().resetState()
        vi.mocked(useSelectedAccount).mockReturnValue(null)
        registerAlgorandRampAdapter()
        rampChainAdapters.register({
            chainId: 'ethereum',
            fromRouterAssetId: () => null,
        })
    })

    describe('a chosen chain', () => {
        it('opens on the first chain with none chosen', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(onBoth)

            const { result } = renderHook(() => useOnrampAccount())

            expect(result.current.scope?.chainId).toBe('algorand')
            expect(result.current.address).toBe('ALGORAND_ADDRESS')
        })

        it("buys onto the chosen chain at the account's address there", () => {
            vi.mocked(useSelectedAccount).mockReturnValue(onBoth)
            useOnrampStore.getState().setSelectedChainId('ethereum')

            const { result } = renderHook(() => useOnrampAccount())

            expect(result.current.scope?.chainId).toBe('ethereum')
            expect(result.current.address).toBe('0xabc')
        })

        it('falls back to the account chain when it is not on the chosen one, and restores the choice on switching back', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(
                algorandAccountAt('ALGORAND_ADDRESS'),
            )
            useOnrampStore.getState().setSelectedChainId('ethereum')
            const { result, rerender } = renderHook(() => useOnrampAccount())
            expect(result.current.scope?.chainId).toBe('algorand')

            vi.mocked(useSelectedAccount).mockReturnValue(onBoth)
            rerender()

            expect(result.current.scope?.chainId).toBe('ethereum')
        })

        it('moves to the other chain when onramp is killed on the chosen one', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(onBoth)
            useOnrampStore.getState().setSelectedChainId('ethereum')
            const { result, rerender } = renderHook(() => useOnrampAccount())
            expect(result.current.scope?.chainId).toBe('ethereum')

            act(() => {
                setCapabilityOverrides({ onramp: false }, 'ethereum')
            })
            rerender()

            expect(result.current.scope?.chainId).toBe('algorand')
        })

        it('has no scope on an Ethereum-only account once onramp is killed there', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(onEthereumOnly)
            setCapabilityOverrides({ onramp: false }, 'ethereum')

            const { result } = renderHook(() => useOnrampAccount())

            expect(result.current.scope).toBeNull()
            expect(result.current.address).toBeNull()
        })

        it('buys onto an Ethereum-only account at its Ethereum address', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(onEthereumOnly)

            const { result } = renderHook(() => useOnrampAccount())

            expect(result.current.scope?.chainId).toBe('ethereum')
            expect(result.current.address).toBe('0xdef')
        })
    })

    it("buys onto the account's chain at its address", () => {
        vi.mocked(useSelectedAccount).mockReturnValue(
            algorandAccountAt('ALGORAND_ADDRESS'),
        )

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(result.current.address).toBe('ALGORAND_ADDRESS')
        expect(result.current.account?.id).toBe('ALGORAND_ADDRESS')
    })

    it("has no scope when the account's chain has onramp off", () => {
        vi.mocked(useSelectedAccount).mockReturnValue(
            algorandAccountAt('ALGORAND_ADDRESS'),
        )
        setCapabilityOverrides({ onramp: false })

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toBeNull()
        expect(result.current.address).toBeNull()
    })

    it('has no scope for an account with no address on an onramp chain', () => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            id: 'elsewhere',
            custody: { kind: 'watch' },
            chains: { base: { address: '0xADDRESS' } },
        })

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toBeNull()
    })

    it('has no scope without a selected account', () => {
        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current).toEqual({
            account: null,
            scope: null,
            address: null,
        })
    })
})
