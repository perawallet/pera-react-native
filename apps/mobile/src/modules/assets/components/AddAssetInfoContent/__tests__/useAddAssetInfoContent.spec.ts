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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { useAddAssetInfoContent } from '../useAddAssetInfoContent'

const { mockChainIds } = vi.hoisted(() => ({
    mockChainIds: vi.fn((): string[] => []),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector({ getSelectedAccount: () => ({ id: 'account' }) }),
    useAccountHoldingSources: () =>
        mockChainIds().map(chainId => ({
            address: 'address',
            scope: { chainId, networkId: 'mainnet' },
        })),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    getChainDescriptor: (chainId: string) => ({
        protocol: { requiresAssetOptIn: chainId === 'algorand' },
    }),
}))

describe('useAddAssetInfoContent', () => {
    it('adds no notes for an account on Algorand alone', () => {
        mockChainIds.mockReturnValue(['algorand'])

        const { result } = renderHook(() => useAddAssetInfoContent())

        expect(result.current.hasAddingNotes).toBe(false)
    })

    it('explains both ways of adding for an account on Algorand and Ethereum', () => {
        mockChainIds.mockReturnValue(['algorand', 'ethereum'])

        const { result } = renderHook(() => useAddAssetInfoContent())

        expect(result.current).toEqual({
            hasAddingNotes: true,
            hasOptInNote: true,
        })
    })

    it('leaves out the opt-in note for an account only on EVM chains', () => {
        mockChainIds.mockReturnValue(['ethereum', 'base'])

        const { result } = renderHook(() => useAddAssetInfoContent())

        expect(result.current).toEqual({
            hasAddingNotes: true,
            hasOptInNote: false,
        })
    })
})
