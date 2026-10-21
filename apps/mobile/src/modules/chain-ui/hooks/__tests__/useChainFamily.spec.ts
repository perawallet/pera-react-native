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
import { useChainFamily } from '../useChainFamily'

const mocks = vi.hoisted(() => ({
    chains: [] as { id: string; family: string; displayName: string }[],
    familyLabels: {} as Record<string, string | undefined>,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            list: () => mocks.chains,
            get: (id: string) => ({
                descriptor: mocks.chains.find(chain => chain.id === id),
            }),
        },
    }),
}))

vi.mock('../../registry', () => ({
    chainUiFor: (family: string) => ({
        familyLabel: mocks.familyLabels[family],
    }),
}))

vi.mock('@hooks/useLanguage')

describe('useChainFamily', () => {
    beforeEach(() => {
        mocks.chains = [
            { id: 'algorand', family: 'algorand', displayName: 'Algorand' },
            { id: 'ethereum', family: 'evm', displayName: 'Ethereum' },
            { id: 'base', family: 'evm', displayName: 'Base' },
        ]
        mocks.familyLabels = { evm: 'chain_families.evm' }
    })

    it("names the family by its chain UI's label, led by its first registered chain", () => {
        const { result } = renderHook(() => useChainFamily('evm'))

        expect(result.current).toMatchObject({
            label: 'chain_families.evm',
            leadChainId: 'ethereum',
        })
    })

    it("falls back to the lead chain's name when the family has no label", () => {
        mocks.familyLabels = {}

        const { result } = renderHook(() => useChainFamily('evm'))

        expect(result.current.label).toBe('Ethereum')
    })

    it('falls back to the family id when none of its chains is registered', () => {
        mocks.chains = mocks.chains.slice(0, 1)
        mocks.familyLabels = {}

        const { result } = renderHook(() => useChainFamily('evm'))

        expect(result.current).toMatchObject({
            label: 'evm',
            leadChainId: undefined,
        })
    })
})
