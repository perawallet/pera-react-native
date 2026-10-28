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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChainNameWhenMultiChain } from '../useChainNameWhenMultiChain'

const mocks = vi.hoisted(() => ({
    basis: 'native' as 'native' | 'fiat',
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountValueBasis: () => mocks.basis,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ algorand: 'Algorand', ethereum: 'Ethereum' })[chainId],
}))

describe('useChainNameWhenMultiChain', () => {
    beforeEach(() => {
        mocks.basis = 'native'
    })

    it('names no chain while every account is on the home chain', () => {
        const { result } = renderHook(() =>
            useChainNameWhenMultiChain('ethereum'),
        )

        expect(result.current).toBeUndefined()
    })

    it('names the requested chain once the wallet spans chains', () => {
        mocks.basis = 'fiat'

        const ethereum = renderHook(() =>
            useChainNameWhenMultiChain('ethereum'),
        )
        const algorand = renderHook(() =>
            useChainNameWhenMultiChain('algorand'),
        )

        expect(ethereum.result.current).toBe('Ethereum')
        expect(algorand.result.current).toBe('Algorand')
    })
})
