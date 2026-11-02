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

const mocks = vi.hoisted(() => ({
    chains: [] as readonly { id: string }[],
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: (chainId: string) => ({
        chainId,
        networkId: 'mainnet',
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: { list: () => mocks.chains },
    }),
}))

import { useHomeChainScope } from '../useHomeChainScope'

describe('useHomeChainScope', () => {
    beforeEach(() => {
        mocks.chains = []
    })

    it('takes the id from the first registered chain descriptor', () => {
        mocks.chains = [{ id: 'algorand' }, { id: 'ethereum' }]

        const { result } = renderHook(() => useHomeChainScope())

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })

    it('follows registry order rather than naming a chain itself', () => {
        mocks.chains = [{ id: 'ethereum' }, { id: 'algorand' }]

        const { result } = renderHook(() => useHomeChainScope())

        expect(result.current).toEqual({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
    })
})
