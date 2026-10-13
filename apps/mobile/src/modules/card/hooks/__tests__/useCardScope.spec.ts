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

const { useSelectedScope } = vi.hoisted(() => ({
    useSelectedScope: vi.fn((chainId: string) => ({
        chainId,
        networkId: 'testnet',
    })),
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope,
}))

import { useCardScope } from '../useCardScope'

describe('useCardScope', () => {
    it("runs the card on Algorand's selected network", () => {
        const { result } = renderHook(() => useCardScope())

        expect(useSelectedScope).toHaveBeenCalledWith('algorand')
        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })
})
