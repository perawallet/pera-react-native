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
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useChainLabel } from '../useChainLabel'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params: { chain: string }) => `${key}:${params.chain}`,
    }),
}))

describe('useChainLabel', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('names the chain by its registered display name', () => {
        const ethereum = renderHook(() => useChainLabel('ethereum')).result
            .current
        const algorand = renderHook(() => useChainLabel('algorand')).result
            .current

        expect(ethereum.label).toBe(
            'account_details.assets.chain_network:Ethereum',
        )
        expect(algorand.label).toBe(
            'account_details.assets.chain_network:Algorand',
        )
    })

    it('falls back to the chain id for a chain that is not registered', () => {
        const { result } = renderHook(() => useChainLabel('polygon'))

        expect(result.current.label).toBe(
            'account_details.assets.chain_network:polygon',
        )
    })
})
