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

import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useCapableChainId, useCapableChainIds } from '../useCapableChainIds'

describe('useCapableChainIds', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('lists only the chains with the capability on, in registry order', () => {
        registerEthereumChain()

        const { result } = renderHook(() => useCapableChainIds('multisig'))

        expect(result.current).toEqual(['algorand'])
    })

    it('includes a second chain once the capability is switched on there', () => {
        registerEthereumChain()
        setCapabilityOverrides({ giftCards: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useCapableChainIds('giftCards'))

        expect(result.current).toEqual(['algorand', ETHEREUM_CHAIN_ID])
    })
})

describe('useCapableChainId', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('picks the first capable chain', () => {
        registerEthereumChain()
        setCapabilityOverrides({ multisig: false }, 'algorand')
        setCapabilityOverrides({ multisig: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useCapableChainId('multisig'))

        expect(result.current).toBe(ETHEREUM_CHAIN_ID)
    })

    it('falls back to the first registered chain when none is capable', () => {
        setCapabilityOverrides({ multisig: false }, 'algorand')

        const { result } = renderHook(() => useCapableChainId('multisig'))

        expect(result.current).toBe('algorand')
    })
})
