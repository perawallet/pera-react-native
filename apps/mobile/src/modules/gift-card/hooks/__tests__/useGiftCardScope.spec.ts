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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

import { useGiftCardScope } from '../useGiftCardScope'

const accountOn = (chainId: string): WalletAccount => ({
    id: `account-${chainId}`,
    name: '',
    chains: { [chainId]: { address: 'ADDR', keyPairId: 'kp' } },
    custody: { kind: 'local', seed: null },
})

describe('useGiftCardScope', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it("scopes to an Algorand account's own chain", () => {
        const { result } = renderHook(() =>
            useGiftCardScope(accountOn('algorand')),
        )

        expect(result.current.chainId).toBe('algorand')
    })

    it('scopes an Ethereum account to Ethereum when Ethereum has gift cards on', () => {
        registerEthereumChain()
        setCapabilityOverrides({ giftCards: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() =>
            useGiftCardScope(accountOn(ETHEREUM_CHAIN_ID)),
        )

        expect(result.current.chainId).toBe(ETHEREUM_CHAIN_ID)
    })

    it('pays an account found active only on Ethereum from its Algorand address', () => {
        registerEthereumChain()
        const evmFirst: WalletAccount = {
            id: 'evm-first',
            name: '',
            chains: {
                algorand: {
                    address: 'ALGO',
                    keyPairId: 'kp-algo',
                    enabledBy: 'created',
                },
                [ETHEREUM_CHAIN_ID]: {
                    address: '0xETH',
                    keyPairId: 'kp-eth',
                    enabledBy: 'discovery',
                },
            },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }

        const { result } = renderHook(() => useGiftCardScope(evmFirst))

        expect(result.current.chainId).toBe('algorand')
    })

    it('falls back to the first gift-card chain without an account', () => {
        registerEthereumChain()
        setCapabilityOverrides({ giftCards: false }, 'algorand')
        setCapabilityOverrides({ giftCards: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useGiftCardScope(undefined))

        expect(result.current.chainId).toBe(ETHEREUM_CHAIN_ID)
    })
})
