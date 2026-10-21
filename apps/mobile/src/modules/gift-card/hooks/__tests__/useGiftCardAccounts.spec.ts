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

const accountOn = (chainId: string): WalletAccount => ({
    id: `account-${chainId}`,
    chains: { [chainId]: { address: `ADDR-${chainId}`, keyPairId: 'kp' } },
    custody: { kind: 'local', seed: null },
})

const ALGORAND_ACCOUNT = accountOn('algorand')
const ETHEREUM_ACCOUNT = accountOn(ETHEREUM_CHAIN_ID)

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        useAllAccounts: () => [ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT],
    }
})

import { useGiftCardAccounts } from '../useGiftCardAccounts'

describe('useGiftCardAccounts', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('keeps only accounts on a chain with gift cards on', () => {
        registerEthereumChain()
        setCapabilityOverrides({ giftCards: true }, 'algorand')
        setCapabilityOverrides({ giftCards: false }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useGiftCardAccounts())

        expect(result.current).toEqual([ALGORAND_ACCOUNT])
    })

    it('includes every account when each chain has gift cards on', () => {
        registerEthereumChain()
        setCapabilityOverrides({ giftCards: true }, 'algorand')
        setCapabilityOverrides({ giftCards: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useGiftCardAccounts())

        expect(result.current).toEqual([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
    })
})
